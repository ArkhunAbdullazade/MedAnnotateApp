const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,
  '../../src/MedAnnotateApp.Presentation/wwwroot/js/canvas.js'), 'utf8');
const drawingContext = new Proxy({}, {get: () => () => {}});

class Element {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.attributes = {};
    this.style = {};
    this.className = '';
    this.offsetWidth = 30;
    this.offsetHeight = 100;
    this.classList = {
      contains: value => this.className.split(/\s+/).includes(value),
      add: value => { if (!this.classList.contains(value)) this.className += ` ${value}`; },
      remove: value => { this.className = this.className.split(/\s+/).filter(item => item !== value).join(' '); },
      toggle: (value, enabled) => enabled ? this.classList.add(value) : this.classList.remove(value)
    };
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  appendChild(child) { this.children.push(child); return child; }
  removeChild(child) { this.children.splice(this.children.indexOf(child), 1); }
  addEventListener() {}
  getContext() { return drawingContext; }
  querySelector(tagName) { return this.children.find(child => child.tagName === tagName); }
  getBoundingClientRect() {
    const left = parseFloat(this.style.left) || 100, top = parseFloat(this.style.top) || 120;
    const width = parseFloat(this.style.width) || 600, height = parseFloat(this.style.height) || 400;
    return {left, top, width, height, right: left + width, bottom: top + height};
  }
}

function toolbar() {
  const document = {body: new Element('body'), createElement: name => new Element(name),
    addEventListener() {}, removeEventListener() {}};
  const context = {window: {innerWidth: 1200}, document, console};
  vm.runInNewContext(source, context, {filename: 'canvas.js'});
  const manager = Object.create(context.window.CanvasManager.prototype);
  const canvas = new Element('canvas');
  canvas.width = 1200; canvas.height = 800;
  Object.assign(manager, {canvas, ctx: drawingContext, sourceImage: {},
    currentMode: 'rectangle', annotations: [], ready: true, usingLens: false,
    lens: null, _lensSize: 150, _zoomFactor: 4});
  return {manager, tools: manager.createTools(new Element('div'))};
}

function pressed(button, expected) {
  assert.equal(button.classList.contains('active'), expected);
  assert.equal(button.getAttribute('aria-pressed'), String(expected));
}

test('toolbar starts with rectangle selected and exposes every tool state', () => {
  const {tools} = toolbar();
  pressed(tools.rectButton, true);
  pressed(tools.freehandButton, false);
  pressed(tools.magnifyButton, false);
  for (const button of Object.values(tools)) assert.ok(button.getAttribute('aria-label'));
});

test('rectangle and freehand selection keep visual and accessible state together', () => {
  const {manager, tools} = toolbar();
  manager.switchMode('freehand');
  assert.equal(manager.currentMode, 'freehand');
  pressed(tools.rectButton, false); pressed(tools.freehandButton, true);
  manager.switchMode('rectangle');
  assert.equal(manager.currentMode, 'rectangle');
  pressed(tools.rectButton, true); pressed(tools.freehandButton, false);
});

test('magnifier toggles independently without changing drawing mode or stored shapes', () => {
  const {manager, tools} = toolbar();
  const shapes = [{type: 'rectangle', cx: 200, cy: 200, width: 100, height: 80, rotation: 0},
    {type: 'freehand', points: [{x: 20, y: 30}, {x: 60, y: 30}, {x: 40, y: 70}]}];
  manager.annotations = shapes;
  const before = JSON.stringify(shapes);
  manager.switchMode('freehand');
  manager.switchMode('magnifier');
  assert.equal(manager.usingLens, true); assert.ok(manager.lens);
  assert.equal(manager.currentMode, 'freehand');
  pressed(tools.magnifyButton, true); pressed(tools.freehandButton, true);
  manager.switchMode('magnifier');
  assert.equal(manager.usingLens, false); assert.equal(manager.lens, null);
  assert.equal(manager.currentMode, 'freehand');
  pressed(tools.magnifyButton, false); pressed(tools.freehandButton, true);
  assert.equal(manager.annotations, shapes);
  assert.equal(JSON.stringify(manager.annotations), before);
});

test('changing drawing mode closes the lens and clears its selected state', () => {
  const {manager, tools} = toolbar();
  manager.switchMode('magnifier');
  manager.switchMode('freehand');
  assert.equal(manager.usingLens, false); assert.equal(manager.lens, null);
  assert.equal(manager.currentMode, 'freehand');
  pressed(tools.magnifyButton, false);
  pressed(tools.rectButton, false); pressed(tools.freehandButton, true);
});

test('magnifier waits for a decoded image without falsely activating the tool', () => {
  const {manager, tools} = toolbar();
  manager.ready = false;
  manager.switchMode('magnifier');
  assert.equal(manager.usingLens, false); assert.equal(manager.lens, null);
  pressed(tools.magnifyButton, false);
});
