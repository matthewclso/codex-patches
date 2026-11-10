'use strict';
// Run against a locally supplied pristine archive; no bundled app source is stored.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const asar = require('../lib/asar.cjs');
const app = require('../lib/app-patches.cjs');
let patch = require('../patches/theme-background/index.cjs');
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
  const plan = app.inspectArchive(bytes, [patch.id], { allowUnknownForAudit: true });
  patch = app.patchForSource(patch.id, plan.patches[0].sourceHash);
  const source = asar.readEntry(archive, patch.targetPath).toString();
  const source1103 = ['fb47d6491dc3006b708cb1e14de479b882bf50f88b7daa81818f154c253266aa',
    'ee88fdd77fb7346efb5e91ce73c7c0eee4eba390ffba3192635d5cdbe44e4097'].includes(asar.sha256(bytes));
  const source1029 = source1103 || asar.sha256(bytes) === '77ed4ddc5b388ac8b29f5035f9c98f982b095df55aad6fa6c27bb80d763b9691';
  const source6604 = asar.sha256(bytes) === 'faacb124f33b792bd2c88fbe8b1215fb6869d81b145a919260e16ac11d9c1451';
  const source1027 = source1029 || source6604 || asar.sha256(bytes) === '6fbedf054a8d8cafaf5c745b40aa59176512e106e0bd6308275ae123b60fd074';
  const source1023 = asar.sha256(bytes) === '99ed83950473e34e642f2942226bf40ce9b65e9910afbe8e406120459823c02d';
  assert.equal(asar.sha256(Buffer.from(source)), patch.sourceSha256);
  const patched = patch.apply(source, app.replaceExactlyOnce);
  if(source1029){
    const native=require('./fixtures/rspack-source.cjs'), stock=native.theme(source), fixed=native.theme(patched);
    return fixture={bytes,archive,build,source,patched,source1029,source1103,source1027,defaults:stock.defaults,stock:stock.engine,fixed:fixed.engine};
  }
  const styleVarsPath = path.posix.join(path.posix.dirname(patch.targetPath), source.match(source1023 ? /import\{r as d,t as f\}from"([^"]+)"/ : /import\{r as l,t as u\}from"([^"]+)"/)[1]);
  const styleVarsSource = asar.readEntry(archive, styleVarsPath).toString();
  const defaultsContext = { e: fn => fn };
  if(source1027) vm.runInNewContext(source.slice(source.indexOf('var d;'),source.indexOf('function p('))+';f();globalThis.defaults=d;',defaultsContext);
  else {
    const defaultsPath=path.posix.join(path.posix.dirname(patch.targetPath),source.match(source1023?/import\{n as s,t as c\}from"([^"]+)"/:/import\{n as i,t as a\}from"([^"]+)"/)[1]);
    const defaultsSource=asar.readEntry(archive,defaultsPath).toString();
    vm.runInNewContext(defaultsSource.replace(/^import[^;]+;/, '').replace(/export\{[^}]+\};/, '')+';n();globalThis.defaults=t;',defaultsContext);
  }
  const defaults=JSON.parse(JSON.stringify(defaultsContext.defaults));
  function engine(text) {
    const start = text.indexOf(source1027?'var d;':'function p('), end = text.indexOf(source1027?'function G(':'function W(');
    assert(start >= 0 && end > start, 'Re-audit the actual theme generator boundaries');
    const context = source1023 ? { c: defaults, s() {}, e: fn => fn } : { a: defaults, i() {}, e: fn => fn };
    vm.runInNewContext(text.slice(start, end) + (source1027?';W();globalThis.build=p;':';U();globalThis.build=p;'), context);
    return (theme, variant) => JSON.parse(JSON.stringify(context.build(theme, variant)));
  }
  fixture = { bytes, archive, build, source1027, source6604, source, patched, defaults, styleVarsSource, stock: engine(source), fixed: engine(patched) };
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
sourceTest('native theme lifecycle updates one scoped shell stylesheet without changing opacity preferences', () => {
  const { patched, defaults, fixed, styleVarsSource, source1027, source1029 } = load();
  const helper = { e: fn => fn };
  if(!source1029) vm.runInNewContext(styleVarsSource.replace(/^import[^;]+;/, '').replace(/export\{[^}]+\};/, '') + '\n;globalThis.write=t;', helper);
  let style, appended = 0;
  const doc = {
    documentElement: { dataset: {}, classList: { toggle() {} } },
    head: { querySelector: () => style, append(element) { style = element; appended++; } },
    createElement: () => ({ dataset: {}, textContent: '' }),
  };
  const start = patched.indexOf(source1027?'function ee(':'function Z('), end = patched.indexOf('function Q(', start);
  assert(source1029 || start >= 0 && end > start);
  const context = { l: helper.write, d: helper.write, X: (theme, variant) => fixed(theme, variant).variables, Y: (theme, variant) => fixed(theme, variant).variables, Q: () => false };
  if(source1029) context.apply=require('./fixtures/rspack-source.cjs').applyTheme(patched,fixed);
  else vm.runInNewContext(patched.slice(start, end) + (source1027?';globalThis.apply=ee;':';globalThis.apply=Z;'), context);
  const themes = { light: { ...defaults.light, surface: '#faf5ec', opaqueWindows: false }, dark: { ...defaults.dark, surface: '#000000', opaqueWindows: false } };
  const originalPreferences = JSON.stringify(themes);
  for (const variant of ['dark', 'light', 'dark']) {
    context.apply(doc, themes, variant);
    assert.equal(doc.documentElement.dataset.theme, variant);
    assert.equal(appended, 1);
    assert.equal(style.textContent.split(patch.shellCss).length - 1, 1);
    assert(style.textContent.includes('--app-color-background-shell:#faf5ec;'));
    assert(style.textContent.includes('--app-color-background-shell:#000000;'));
    assert.equal(JSON.stringify(themes), originalPreferences);
  }
  assert(patch.shellCss.startsWith(':root[data-codex-window-type="electron"][data-codex-os="win32"]'));
  assert(patch.shellCss.includes('[data-app-shell-frame]'));
  assert(patch.shellCss.includes('[data-app-shell-page-surface="true"]'));
  assert(patch.shellCss.includes('.app-shell-left-panel'));
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
  const defaultIds = build ? resolveSelection({ schemaVersion: 1, patches: {} }, build).appPatches : [patch.id];
  const otherIds = build ? resolveSelection({ schemaVersion: 1, patches: { 'theme-background': 'disabled' } }, build).appPatches : [];
  const compose = ids => {
    if (build) return app.transformArchive(bytes, ids);
    const result = app.auditArchive(bytes, ids);
    assert(result.buffer); assert(result.report.reviewRequired);
    assert.throws(() => app.transformArchive(bytes, ids), /Unsupported Codex archive/);
    return result;
  };
  const without = compose(otherIds), withTheme = compose(defaultIds);
  if (build) {
    assert.deepEqual(defaultIds, build.composedApp.selectedIds);
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
  const otherTargets = new Set((without.changes ?? without.report.changes).map(change => change.targetPath));
  for (const { path: name } of asar.listEntries(archive.tree)) {
    if (name === patch.targetPath) continue;
    const before = asar.lookup(disabled.tree, name), after = asar.lookup(enabled.tree, name);
    if (otherTargets.has(name)) {
      // Appended patched entries can move when an earlier patch is disabled.
      assert.deepEqual({ ...after, offset: before.offset }, before);
      assert(asar.readEntry(enabled, name).equals(asar.readEntry(disabled, name)));
    } else assert.deepEqual(after, before);
  }
  const unknown = asar.serializeArchive({ ...archive.tree, themeAudit: true }, archive.payload);
  assert.throws(() => app.transformArchive(unknown, [patch.id]), /Unsupported Codex archive/);
});

sourceTest('Chromium covers actual Windows frames, native material, menu chrome and Electron surface overrides', async t => {
  if (!process.env.CODEX_PLAYWRIGHT_MODULE) return t.skip('Set CODEX_PLAYWRIGHT_MODULE to a local playwright or playwright-core module');
  const { archive, source, patched, stock, fixed, defaults, styleVarsSource, source1027, source6604, source1029, source1103 } = load();
  const { chromium } = require(process.env.CODEX_PLAYWRIGHT_MODULE);
  const browser = await chromium.launch({ headless: true });
  function documentUpdater(text) {
    if(source1029)return require('./fixtures/rspack-source.cjs').updater(text);
    const start = text.indexOf(source1027?'function ee(':'function Z('), end = text.indexOf('function Q(', start);
    assert(start >= 0 && end > start, 'Re-audit the native document theme updater');
    return text.slice(start, end);
  }
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    const paths = asar.listEntries(archive.tree).map(e => e.path);
    const css = source1029 ? require('./fixtures/rspack-source.cjs').css(archive,source1103) : source1027 ? [source6604?'webview/assets/fd9b7fd80db1.css':'webview/assets/5257da4ba4ae.css','webview/assets/59ad52d5aa88.css'].map(name=>asar.readEntry(archive,name).toString()).join(String.fromCharCode(10)) : ['shared', 'primary'].map(name => {
      const matches = paths.filter(p => new RegExp('^webview/assets/app-' + name + '-[^/]+\\.css$').test(p));
      assert.equal(matches.length, 1);
      return asar.readEntry(archive, matches[0]).toString();
    }).join('\n');
    const writerCode = source1029 ? '' : styleVarsSource.replace(/^import[^;]+;/, '').replace(/export\{[^}]+\};/, '');
    async function fixture(layout, menu, opaque) {
      // Actual HAt/OAt attributes/classes and native opacity setup. The backdrop
      // represents OS material behind a transparent Electron renderer. No fixture
      // CSS supplies or corrects a shell background.
      const classes=source1029?require('./fixtures/rspack-source.cjs').classes:{layout:'_Layout_azz1c_2',page:'_PageSurfaceLayout_azz1c_2',full:'_FullHeightPageSurfaceLayout_azz1c_2',menu:'_ApplicationMenuPageSurfaceLayout_azz1c_2',topbar:'_ApplicationMenuTopBar_azz1c_2',left:'_LeftPanel_azz1c_2'};
      const shellClass = (layout === 'page' ? classes.page : classes.full) + (source1027 && menu && layout==='page' ? ' '+classes.menu : '');
      await page.setContent('<html data-codex-window-type="electron" data-codex-os="win32" data-theme="dark"' +
        (menu ? ' data-codex-window-chrome="application-menu"' : '') + (opaque ? ' class="electron-opaque"' : '') +
        '><head></head><body><div style="position:fixed;inset:0;z-index:-1;background-color:#202020"></div>' +
        '<div id="shell" data-app-shell-frame data-app-shell-page-surface="true" data-app-shell-workspace-tab-chrome class="' + classes.layout + ' ' + shellClass + '" style="position:relative;width:1000px;height:700px">' +
        '<header id="topbar" class="' + classes.topbar + '" style="position:absolute;inset:0 0 auto;height:40px"></header>' +
        '<aside id="rail" class="electron:bg-transparent" style="position:absolute;left:0;top:40px;width:48px;height:610px"></aside>' +
        '<aside class="app-shell-left-panel ' + classes.left + '" data-app-shell-left-panel-appearance="default" style="position:absolute;left:48px;top:40px;width:220px;height:610px">' +
        '<nav id="sidebar" class="sidebar-navigation" style="width:100%;height:100%"></nav></aside>' +
        '<main id="chat" class="bg-surface" style="position:absolute;left:268px;top:40px;width:732px;height:610px">' +
        '<div id="editor" class="bg-surface-tertiary" style="position:absolute;top:0;width:100px;height:50px"></div></main></div></body></html>');
      await page.addStyleTag({ content: css });
      await page.addScriptTag({ content: '(function(){' + writerCode + '\n;window.writeNativeTheme=t;})();' });
    }
    async function render(engine, text, variant, surface) {
      const palettes = Object.fromEntries(['light', 'dark'].map(v => [v, engine({ ...defaults[v], surface }, v).variables]));
      await page.evaluate(({ palettes, updater, variant }) => {
        // Actual document updater and stylesheet writer; only palette lookup
        // and the unrelated account-color predicate are supplied here.
        window.fixturePalettes = palettes;
        const apply = new Function('l', 'd', 'X', 'Y', 'Q', 'U', 'j', updater + ';return '+(updater.startsWith('function F(')?'F':updater.startsWith('function A(')?'A':updater.startsWith('function ee(')?'ee':'Z')+';')(
          window.writeNativeTheme, window.writeNativeTheme, (_,v)=>window.fixturePalettes[v], (_, v) => window.fixturePalettes[v], () => false, (_,v)=>window.fixturePalettes[v],()=>false);
        window.applyFixtureTheme = v => apply(document, { light: {}, dark: {} }, v);
        window.applyFixtureTheme(variant);
        window.applyFixtureTheme(variant);
      }, { palettes, updater: documentUpdater(text), variant });
      const screenshot = await page.screenshot();
      return page.evaluate(async base64 => {
        const bitmap = await createImageBitmap(await (await fetch('data:image/png;base64,' + base64)).blob());
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0);
        const pixels = Object.fromEntries(['shell', 'sidebar', 'rail', 'topbar', 'chat', 'editor'].map(id => {
          const bounds = document.getElementById(id).getBoundingClientRect();
          const x = bounds.x + bounds.width / 2, y = id === 'shell' ? bounds.bottom - 5 : bounds.y + bounds.height / 2;
          return [id, Array.from(context.getImageData(Math.floor(x), Math.floor(y), 1, 1).data).slice(0, 3)];
        }));
        return { pixels, stylesheet: document.head.querySelector('style[data-codex-app-themes]').textContent };
      }, screenshot.toString('base64'));
    }
    // The installed first revision left the ordinary Windows frame transparent.
    await fixture('page', true, false);
    const paletteOnly = app.replaceExactlyOnce(source, patch.before, patch.after);
    const previous = await render(fixed, paletteOnly, 'dark', '#000000');
    for (const id of ['shell', 'topbar', 'rail', 'sidebar']) assert.notDeepEqual(previous.pixels[id], [0, 0, 0], 'First revision must reproduce ' + id);
    for (const layout of ['page', 'full-height']) for (const menu of [false, true]) for (const opaque of [false, true]) {
      await fixture(layout, menu, opaque);
      for (const [variant, surface] of [['dark', '#000000'], ['dark', '#123456'], ['light', '#faf5ec'], ['dark', '#000000']]) {
        const rendered = await render(fixed, patched, variant, surface);
        const expected = [1, 3, 5].map(i => parseInt(surface.slice(i, i + 2), 16));
        for (const id of ['shell', 'sidebar', 'rail', 'topbar', 'chat']) assert.deepEqual(rendered.pixels[id], expected, [id, layout, menu, opaque, variant, surface].join(' '));
        assert.equal(rendered.stylesheet.split(patch.shellCss).length - 1, 1, 'Repeated writes retain exactly one scoped shell rule');
        const editor = stock({ ...defaults[variant], surface }, variant).variables['--app-color-background-editor-opaque'];
        assert.deepEqual(rendered.pixels.editor, editor.match(/\d+/g).map(Number), 'Retain editor contrast background');
      }
      // Native theme stylesheet already contains both modes.
      await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
      assert.equal(await page.locator('#shell').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(0, 0, 0)');
    }
  } finally { await browser.close(); }
});
