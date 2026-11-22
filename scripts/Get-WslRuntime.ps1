# The desktop uses this same versioned release for its downloaded WSL CLI.
function Get-OfficialWslRuntime {
    param(
        [Parameter(Mandatory)][string]$CliVersion,
        [Parameter(Mandatory)][string]$Directory,
        [string]$ExpectedArchiveSha256
    )
    $ProgressPreference = 'SilentlyContinue'
    if ($CliVersion -cnotmatch '^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$') { throw 'Invalid desktop CLI version.' }
    $target = 'x86_64-unknown-linux-musl'
    $base = "https://releases.openai.com/codex/releases/$([uri]::EscapeDataString($CliVersion))"
    $assetName = "codex-package-$target.tar.gz"
    $url = "$base/$assetName"
    if (-not $ExpectedArchiveSha256) {
        $release = Invoke-RestMethod -UseBasicParsing -Uri "$base/release.json" -TimeoutSec 30 -MaximumRedirection 0
        $assets = @($release.assets | Where-Object { $_.name -ceq $assetName })
        if ($release.tag_name -cne "rust-v$CliVersion" -or $assets.Count -ne 1 -or
            $assets[0].browser_download_url -cne $url -or $assets[0].digest -cnotmatch '^sha256:[a-f0-9]{64}$') {
            throw 'The matching OpenAI release does not identify a verified x64 Linux runtime.'
        }
        $ExpectedArchiveSha256 = $assets[0].digest.Substring(7)
    }
    if ($ExpectedArchiveSha256 -cnotmatch '^[a-f0-9]{64}$') { throw 'Invalid reviewed WSL runtime hash.' }
    New-Item -ItemType Directory -Path $Directory -ErrorAction Stop | Out-Null
    $download = Join-Path $Directory 'runtime.tar.gz'
    $unpacked = Join-Path $Directory 'unpacked'
    New-Item -ItemType Directory -Path $unpacked -ErrorAction Stop | Out-Null
    Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $download -TimeoutSec 300 -MaximumRedirection 0
    if ((Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash -ne $ExpectedArchiveSha256) {
        throw 'Downloaded WSL runtime hash mismatch.'
    }
    $files = [ordered]@{
        'bin/codex' = 'codex'
        'bin/codex-code-mode-host' = 'codex-code-mode-host'
        'bin/codex-exec-server' = 'codex-exec-server'
        'codex-resources/bwrap' = 'codex-resources/bwrap'
        'codex-path/rg' = 'codex-path/rg'
    }
    $entries = @('codex-package.json') + @($files.Keys)
    & tar.exe -xf $download -C $unpacked @entries
    if ($LASTEXITCODE -ne 0) { throw 'Unable to extract the verified WSL runtime.' }
    $manifest = Get-Content -LiteralPath (Join-Path $unpacked 'codex-package.json') -Raw | ConvertFrom-Json
    if ($manifest.layoutVersion -ne 1 -or $manifest.version -cne $CliVersion -or $manifest.target -cne $target -or
        $manifest.variant -cne 'codex' -or $manifest.entrypoint -cne 'bin/codex' -or
        $manifest.execServer -cne 'bin/codex-exec-server' -or $manifest.resourcesDir -cne 'codex-resources' -or $manifest.pathDir -cne 'codex-path') {
        throw 'Downloaded WSL runtime does not match the desktop CLI or its expected layout.'
    }
    $runtime = Join-Path $Directory 'resources'
    $hashes = [ordered]@{}
    foreach ($entry in $files.GetEnumerator()) {
        $source = Get-Item -LiteralPath (Join-Path $unpacked $entry.Key) -ErrorAction Stop
        if ($source.PSIsContainer -or $source.Length -eq 0 -or ($source.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "Expected a regular WSL runtime file: $($entry.Key)"
        }
        $destination = Join-Path $runtime $entry.Value
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        Move-Item -LiteralPath $source.FullName -Destination $destination
        $hashes[$entry.Value] = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    [pscustomobject]@{ Directory = $runtime; Metadata = [ordered]@{ archiveSha256 = $ExpectedArchiveSha256; files = $hashes } }
}
