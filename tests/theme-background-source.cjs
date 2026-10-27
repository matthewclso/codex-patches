'use strict';
// Run against a locally supplied pristine archive; no bundled app source is stored.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const asar = require('../lib/asar.cjs');
const app = require('../lib/app-patches.cjs');
const patch = require('../patches/theme-background/index.cjs');
const { resolveSelection } = require('../lib/selection.cjs');
const compatibility = require('../compatibility/current.json');
const sourcePath = process.env.CODEX_SOURCE_ASAR;
const sourceTest = (name, fn) => test(name, { skip: !sourcePath && 'Set CODEX_SOURCE_ASAR to a pristine Codex app.asar' }, t => {
  if (load().inapplicable) return t.skip('Theme patch is not reviewed for this historical build');
  return fn(t);
});
let fixture;
function load() {
  if (fixture) return fixture;
  const bytes = fs.readFileSync(sourcePath), archive = asar.parseArchive(bytes);
  const build = compatibility.builds.find(b => b.archiveSha256 === asar.sha256(bytes));
  if (build && build.patches[patch.id]?.status !== 'needed') return fixture = { inapplicable: true };
  const source = asar.readEntry(archive, patch.targetPath).toString();
  assert.equal(asar.sha256(Buffer.from(source)), patch.sourceSha256);
  const patched = patch.apply(source, app.replaceExactlyOnce);
  const defaultsPath = path.posix.join(path.posix.dirname(patch.targetPath), source.match(/import\{n as i,t as a\}from"([^"]+)"/)[1]);
  const defaultsSource = asar.readEntry(archive, defaultsPath).toString();
  const defaultsContext = { e: fn => fn };
  vm.runInNewContext(defaultsSource.replace(/^import[^;]+;/, '').replace(/export\{[^}]+\};/, '') + '\n;n();globalThis.defaults=t;', defaultsContext);
  const defaults = JSON.parse(JSON.stringify(defaultsContext.defaults));
  function engine(text) {
    const start = text.indexOf('function p('), end = text.indexOf('function W(');
    assert(start >= 0 && end > start, 'Re-audit the actual theme generator boundaries');
    const context = { a: defaults, i() {}, e: fn => fn };
    vm.runInNewContext(text.slice(start, end) + ';U();globalThis.build=p;', context);
    return (theme, variant) => JSON.parse(JSON.stringify(context.build(theme, variant)));
  }
  fixture = { bytes, archive, build, source, patched, defaults, stock: engine(source), fixed: engine(patched) };
  return fixture;
}
function themes(defaults) {
  return ['light', 'dark'].flatMap(variant => ['#000000', '#123456', '#faf5ec', '#ffffff'].flatMap(surface =>
    [0, 60, 100].flatMap(contrast => [false, true].map(opaqueWindows => ({
      variant, theme: { ...defaults[variant], surface, contrast, opaqueWindows },
    })))));
}
sourceTest('actual theme generator applies all configured backgrounds to sidebar and shell, preserving other colors', () => {
  const { stock, fixed, defaults } = load();
  for (const { theme, variant } of themes(defaults)) {
    const before = stock(theme, variant), after = fixed(theme, variant);
    assert.equal(after.variables['--app-color-background-surface'], theme.surface);
    assert.equal(after.variables['--app-color-background-surface-under'], theme.surface);
    assert.equal(after.variables['--app-color-background-shell'], theme.surface);
    assert(!Object.hasOwn(before.variables, '--app-color-background-shell'));
    // Stock shell resolves to the tinted editor background, even for #000000.
    if (variant === 'dark' && theme.surface === '#000000') assert.notEqual(before.variables['--app-color-background-editor-opaque'], 'rgb(0, 0, 0)');
    const { '--app-color-background-shell': shell, '--app-color-background-surface-under': under, ...rest } = after.variables;
    assert.deepEqual(rest, Object.fromEntries(Object.entries(before.variables).filter(([key]) => key !== '--app-color-background-surface-under')));
    assert.deepEqual({ ...after, variables: null }, { ...before, variables: null });
  }
});
sourceTest('actual theme generator follows live color and light/dark switches without retaining earlier backgrounds', () => {
  const { fixed, defaults } = load();
  for (const [variant, surface] of [['dark', '#000000'], ['dark', '#123456'], ['light', '#faf5ec'], ['dark', '#000000']]) {
    const result = fixed({ ...defaults[variant], surface }, variant).variables;
    for (const key of ['--app-color-background-surface', '--app-color-background-surface-under', '--app-color-background-shell']) assert.equal(result[key], surface);
  }
});
test('theme patch is independently selectable and unsupported builds remain gated', () => {
  const build = { patches: { 'theme-background': { status: 'needed' }, 'browser-wsl': { status: 'needed' } } };
  assert.deepEqual(resolveSelection({ schemaVersion: 1, patches: {} }, build).appPatches, ['browser-wsl', 'theme-background']);
  assert.deepEqual(resolveSelection({ schemaVersion: 1, patches: { 'theme-background': 'disabled' } }, build).appPatches, ['browser-wsl']);
  assert.throws(() => resolveSelection({ schemaVersion: 1, patches: { 'theme-background': 'enabled' } }, { patches: {} }), /no reviewed implementation/);
  assert.throws(() => patch.apply(patch.before + patch.before, app.replaceExactlyOnce), /not unique/);
  assert.throws(() => patch.apply(patch.after, app.replaceExactlyOnce), /anchor missing/);
});
sourceTest('archive selection adds only the reviewed theme entry and disabling it restores pristine theme bytes', () => {
  const { bytes, archive, build, source, patched } = load();
  const otherIds = build ? resolveSelection({ schemaVersion: 1, patches: { 'theme-background': 'disabled' } }, build).appPatches : [];
  const compose = ids => {
    if (build) return app.transformArchive(bytes, ids);
    const result = app.auditArchive(bytes, ids);
    assert(result.buffer); assert(result.report.reviewRequired);
    assert.throws(() => app.transformArchive(bytes, ids), /Unsupported Codex archive/);
    return result;
  };
  const without = compose(otherIds), withTheme = compose([...otherIds, patch.id]);
  if (build) {
    assert.deepEqual([...otherIds, patch.id], build.composedApp.selectedIds);
    assert.equal(withTheme.outputArchiveHash, build.composedApp.archiveSha256);
    assert.equal(withTheme.outputHeaderHash, build.composedApp.headerSha256);
    if (process.env.CODEX_SOURCE_EXE) {
      const executable = asar.updateExecutableIntegrity(fs.readFileSync(process.env.CODEX_SOURCE_EXE), withTheme.sourceHeaderHash, withTheme.outputHeaderHash);
      assert.equal(asar.sha256(executable), build.composedApp.executableSha256);
    }
  }
  const disabled = asar.parseArchive(without.buffer), enabled = asar.parseArchive(withTheme.buffer);
  assert.equal(asar.readEntry(disabled, patch.targetPath).toString(), source);
  assert.equal(asar.readEntry(enabled, patch.targetPath).toString(), patched);
  for (const { path: name } of asar.listEntries(archive.tree)) {
    if (name !== patch.targetPath) assert.deepEqual(asar.lookup(enabled.tree, name), asar.lookup(disabled.tree, name));
  }
  const unknown = asar.serializeArchive({ ...archive.tree, themeAudit: true }, archive.payload);
  assert.throws(() => app.transformArchive(unknown, [patch.id]), /Unsupported Codex archive/);
});

sourceTest('Chromium renders configured shell, sidebar and top bar backgrounds using actual app CSS', async t => {
  if (!process.env.CODEX_PLAYWRIGHT_MODULE) return t.skip('Set CODEX_PLAYWRIGHT_MODULE to a local playwright or playwright-core module');
  const { archive, stock, fixed, defaults } = load();
  const { chromium } = require(process.env.CODEX_PLAYWRIGHT_MODULE);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    const paths = asar.listEntries(archive.tree).map(e => e.path);
    const css = ['shared', 'primary'].map(name => {
      const matches = paths.filter(p => new RegExp('^webview/assets/app-' + name + '-[^/]+\\.css$').test(p));
      assert.equal(matches.length, 1);
      return asar.readEntry(archive, matches[0]).toString();
    }).join('\n');
    // Actual shell classes and theme stylesheet cascade; layout dimensions only
    // are supplied by the fixture. This is renderer evidence, not desktop acceptance.
    await page.setContent('<html data-codex-window-type="electron" data-codex-os="win32" data-theme="dark"><head></head><body><div id="shell" class="_FullHeightPageSurfaceLayout_azz1c_2" style="min-height:600px"><header id="topbar" class="_ApplicationMenuTopBar_azz1c_2"></header><div class="_LeftPanel_azz1c_2"><nav id="sidebar" class="sidebar-navigation" style="width:200px;height:500px"></nav></div><main id="chat" class="bg-surface" style="height:80px"></main></div></body></html>');
    await page.addStyleTag({ content: css });
    await page.addStyleTag({ content: '@layer theme { :root[data-codex-window-type="electron"], :root[data-codex-window-type="electron"] body { background-color:var(--app-color-background-surface-under);background-image:none; } }' });
    const themeStyle = await page.addStyleTag({ content: '/* Theme updates */' });
    async function render(engine, variant, surface) {
      const vars = engine({ ...defaults[variant], surface }, variant).variables;
      // Match style-vars' native @layer theme selectors and specificity.
      await themeStyle.evaluate((element, { vars, variant }) => {
        document.documentElement.dataset.theme = variant;
        element.textContent = '@layer theme { :where(:root:not([data-codex-window-type="extension"]))[data-theme="' + variant + '"] { ' + Object.entries(vars).map(([k, v]) => k + ':' + v + ';').join('') + ' } }';
      }, { vars, variant });
      const screenshot = await page.screenshot();
      return page.evaluate(async base64 => {
        // Sample Chromium's painted pixels, including its translucent layers.
        const bitmap = await createImageBitmap(await (await fetch('data:image/png;base64,' + base64)).blob());
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0);
        return Object.fromEntries(['shell', 'sidebar', 'topbar', 'chat'].map(id => {
          const bounds = document.getElementById(id).getBoundingClientRect();
          const pixel = context.getImageData(Math.floor(bounds.x + bounds.width / 2), Math.floor(bounds.y + bounds.height / 2), 1, 1).data;
          return [id, Array.from(pixel).slice(0, 3)];
        }));
      }, screenshot.toString('base64'));
    }
    const original = await render(stock, 'dark', '#000000');
    assert.notDeepEqual(original.shell, [0, 0, 0]);
    assert.notDeepEqual(original.topbar, [0, 0, 0]);
    assert.notDeepEqual(original.sidebar, [0, 0, 0]);
    for (const [variant, surface] of [['dark', '#000000'], ['dark', '#123456'], ['light', '#faf5ec'], ['dark', '#000000']]) {
      const rendered = await render(fixed, variant, surface);
      const expected = [1, 3, 5].map(i => parseInt(surface.slice(i, i + 2), 16));
      for (const [id, value] of Object.entries(rendered)) assert.deepEqual(value, expected, id + ' in ' + variant + ' ' + surface);
    }
  } finally { await browser.close(); }
});
