function Get-LegacyWrapperMetadata([string]$Path) {
    if (-not ('CodexPatches.LegacyWrapperMetadata' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
namespace CodexPatches {
    [StructLayout(LayoutKind.Sequential)]
    public struct LegacyWrapperAttributes {
        public uint FileAttributes;
        public uint ReparseTag;
    }
    public static class LegacyWrapperMetadata {
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern SafeFileHandle CreateFileW(string path, uint access, uint share,
            IntPtr security, uint disposition, uint flags, IntPtr template);
        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool GetFileInformationByHandleEx(SafeFileHandle handle,
            int infoClass, out LegacyWrapperAttributes info, uint size);
        public static LegacyWrapperAttributes Read(string path) {
            // Query metadata only; OPEN_REPARSE_POINT opens the entry itself.
            // BACKUP_SEMANTICS also permits checking ancestor directories.
            using (SafeFileHandle handle = CreateFileW(path, 0, 7, IntPtr.Zero, 3,
                    0x00200000 | 0x02000000, IntPtr.Zero)) {
                if (handle.IsInvalid) throw new Win32Exception(Marshal.GetLastWin32Error());
                LegacyWrapperAttributes info;
                if (!GetFileInformationByHandleEx(handle, 9, out info, 8))
                    throw new Win32Exception(Marshal.GetLastWin32Error());
                return info;
            }
        }
    }
}
'@
    }
    return [CodexPatches.LegacyWrapperMetadata]::Read($Path)
}

function Test-LegacyCloudReparseTag([uint32]$Tag) {
    # Only IO_REPARSE_TAG_CLOUD and CLOUD_1..F. These tags do not redirect names.
    # (tag & 0xFFFF0FFF) == 0x9000001A; decimal uints avoid PS5 signed hex casts.
    # https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-fscc/c8e77b37-3909-4fe6-a4ea-2b9d423b1ee4
    return ($Tag -band [uint32]4294905855) -eq [uint32]2415919130
}

function Get-LegacyWrapperText([string]$Path) {
    $fullPath = [IO.Path]::GetFullPath($Path)
    $root = [IO.Path]::GetPathRoot($fullPath)
    $paths = [Collections.Generic.List[string]]::new(); $paths.Add($root)
    $current = $root
    foreach ($part in $fullPath.Substring($root.Length).Split([char[]]@('\','/'), [StringSplitOptions]::RemoveEmptyEntries)) {
        $current = Join-Path $current $part
        $paths.Add($current)
    }
    # Check ancestors before opening descendants, so a junction cannot redirect
    # the metadata check or content read. Unknown reparse tags fail closed.
    foreach ($entry in $paths) {
        $info = Get-LegacyWrapperMetadata $entry
        if (($info.FileAttributes -band 0x400) -and -not (Test-LegacyCloudReparseTag $info.ReparseTag)) {
            throw 'The supplied wrapper path cannot contain links or unrecognized reparse points.'
        }
    }
    if ($info.FileAttributes -band 0x10) { throw 'The supplied wrapper must be a regular file.' }
    return [IO.File]::ReadAllText($fullPath, [Text.Encoding]::UTF8)
}
