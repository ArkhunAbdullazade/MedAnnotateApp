const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,
  '../../src/MedAnnotateApp.Presentation/wwwroot/js/studentPage.js'), 'utf8');
const StudentCanvas = vm.runInNewContext(fs.readFileSync(path.join(__dirname,
  '../../src/MedAnnotateApp.Presentation/wwwroot/js/studentCanvas.js'), 'utf8') + '\nStudentCanvasManager');

class Element {
  constructor() { this.children = []; this.listeners = {}; this.dataset = {}; this.textContent = ''; }
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  replaceChildren() { this.children = []; }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.append(child); }
  fire(name) { return Promise.all((this.listeners[name] || []).map(callback => callback())); }
  click() { return this.fire('click'); }
}
function page(response) {
  const elements = Object.fromEntries(['annotation-status', 'submit-button', 'annotations-list',
    'image-container'].map(id => [id, new Element()]));
  const events = {};
  let onReady;
  class StudentCanvasManager {
    constructor() {
      this.groups = [];
      this.baseManager = {ready: true, annotations: [], currentAction: 'none',
        canvas: new Element(), onAnnotationsChange() {}, drawCanvas() {},
        resetAnnotation() { this.annotations = []; this.currentAction = 'none'; }};
    }
    createTools() { return {rectButton: new Element(), freehandButton: new Element(), magnifyButton: new Element()}; }
    getAnnotationGroups() { return this.groups; }
    getAllGroupedAnnotationsJSON() { return this.groups.map(group => ({label: group.label, annotations: []})); }
    deleteGroup(index) { this.groups.splice(index, 1); this.onGroupedAnnotationsChange(); }
    hideTextBox() {}
    cancelCurrentAnnotation() { StudentCanvas.prototype.cancelCurrentAnnotation.call(this); }
  }
  const context = {
    window: {annotatedMedData: {id: 1}, addEventListener(name, callback) { events[name] = callback; }},
    document: {addEventListener(name, callback) { if (name === 'DOMContentLoaded') onReady = callback; },
      getElementById: id => elements[id], querySelector: () => ({value: 'synthetic-csrf'}),
      createElement: () => new Element()},
    StudentCanvasManager, confirm: () => true, location: {},
    fetch() {
      if (!response) throw new Error('This UI state test must not send requests.');
      return Promise.resolve(response).then(result => ({ok: true, json: async () => result}));
    }
  };
  vm.runInNewContext(source, context, {filename: 'studentPage.js'});
  onReady();
  const warnsBeforeLeaving = () => {
    let warned = false;
    events.beforeunload({preventDefault() { warned = true; }});
    return warned;
  };
  return {elements, manager: context.window.canvasManager, warnsBeforeLeaving};
}

test('saving a local group then deleting the last group clears the warning and ready status', () => {
  const {elements, manager, warnsBeforeLeaving} = page();
  manager.groups.push({label: 'test finding', annotations: [{}]});
  manager.onGroupedAnnotationsChange();
  assert.equal(warnsBeforeLeaving(), true);
  assert.equal(elements['annotation-status'].dataset.state, 'unsaved');
  assert.equal(elements['submit-button'].disabled, false);
  const actions = elements['annotations-list'].children[0].children[1];
  actions.children[1].click();
  assert.equal(manager.groups.length, 0);
  assert.equal(warnsBeforeLeaving(), false);
  assert.equal(elements['submit-button'].disabled, true);
  assert.equal(elements['annotation-status'].dataset.state, 'ready');
  assert.match(elements['annotation-status'].textContent, /^Image ready/);
});

test('pending shapes keep warnings after either group or canvas changes and clear when removed', () => {
  const {elements, manager, warnsBeforeLeaving} = page();
  manager.baseManager.annotations = [{}];
  for (const change of [() => manager.onGroupedAnnotationsChange(), () => manager.baseManager.onAnnotationsChange()]) {
    change();
    assert.equal(warnsBeforeLeaving(), true);
    assert.equal(elements['annotation-status'].dataset.state, 'unsaved');
    assert.match(elements['annotation-status'].textContent, /Unsaved shape/);
  }
  manager.baseManager.annotations = [];
  manager.baseManager.onAnnotationsChange();
  assert.equal(warnsBeforeLeaving(), false);
  assert.equal(elements['annotation-status'].dataset.state, 'ready');
});

test('an unfinished gesture warns before leaving even before a shape-change callback', () => {
  const {elements, manager, warnsBeforeLeaving} = page();
  manager.baseManager.currentAction = 'draw';
  assert.equal(warnsBeforeLeaving(), true);
  manager.onGroupedAnnotationsChange();
  assert.equal(elements['annotation-status'].dataset.state, 'unsaved');
  manager.baseManager.currentAction = 'none';
  manager.onGroupedAnnotationsChange();
  assert.equal(warnsBeforeLeaving(), false);
  assert.equal(elements['annotation-status'].dataset.state, 'ready');
});

test('successful submission redirects without warning about the now-persisted groups', async () => {
  const {elements, manager, warnsBeforeLeaving} = page({success: true, redirectUrl: '/Home/Student'});
  manager.groups.push({label: 'test finding', annotations: [{}]});
  manager.onGroupedAnnotationsChange();
  assert.equal(warnsBeforeLeaving(), true);
  await elements['submit-button'].click();
  assert.equal(warnsBeforeLeaving(), false);
});

test('the real student cancel method restores ready status when the draft is empty', () => {
  const {elements, manager, warnsBeforeLeaving} = page();
  manager.baseManager.annotations = [{}];
  manager.currentGroup = {label: 'draft'};
  manager.baseManager.onAnnotationsChange();
  manager.cancelCurrentAnnotation();
  assert.equal(warnsBeforeLeaving(), false);
  assert.equal(elements['annotation-status'].dataset.state, 'ready');
  assert.equal(manager.currentGroup, null);
  assert.equal(manager.selectedGroupIndex, -1);
});

test('cancelling edits preserves the original local group and its submit warning', () => {
  const {elements, manager, warnsBeforeLeaving} = page();
  const group = {label: 'original label', annotations: [{}]};
  manager.groups.push(group);
  manager.currentGroup = {label: 'unsaved replacement'};
  manager.selectedGroupIndex = 0;
  manager.baseManager.annotations = [{}];
  manager.cancelCurrentAnnotation();
  assert.equal(manager.groups[0], group);
  assert.equal(manager.groups[0].label, 'original label');
  assert.equal(elements['submit-button'].disabled, false);
  assert.equal(elements['annotation-status'].dataset.state, 'unsaved');
  assert.match(elements['annotation-status'].textContent, /Groups are held/);
  assert.equal(warnsBeforeLeaving(), true);
});

test('inspection restores student status without changing local groups', () => {
  const {elements, manager} = page();
  const group = {label: 'test finding', annotations: [{}]};
  manager.groups.push(group); manager.onGroupedAnnotationsChange();
  const status = elements['annotation-status'], before = status.textContent;
  manager.baseManager.onInspectionChange(true);
  assert.equal(status.dataset.state, 'inspection');
  assert.match(status.textContent, /Inspection only.*temporarily hidden/);
  assert.equal(manager.groups[0], group);
  manager.baseManager.onInspectionChange(false);
  assert.equal(status.textContent, before);
  assert.equal(status.dataset.state, 'unsaved');
});

test('student status updates during inspection are restored when it ends', () => {
  const {elements, manager} = page();
  manager.baseManager.onInspectionChange(true);
  manager.groups.push({label: 'test finding', annotations: [{}]});
  manager.onGroupedAnnotationsChange();
  const status = elements['annotation-status'];
  assert.equal(status.dataset.state, 'inspection');
  manager.baseManager.onInspectionChange(false);
  assert.equal(status.dataset.state, 'unsaved');
  assert.match(status.textContent, /Groups are held/);
});

test('inspection never covers student errors, including an image error arriving while inspecting', async () => {
  const {elements, manager} = page();
  const status = elements['annotation-status'];
  status.textContent = 'The outline must enclose an area.'; status.dataset.state = 'error';
  manager.baseManager.onInspectionChange(true);
  assert.equal(status.textContent, 'The outline must enclose an area.');
  assert.equal(status.dataset.state, 'error');
  status.textContent = 'This image could not be loaded.'; status.dataset.state = 'error';
  manager.baseManager.ready = false;
  await manager.baseManager.canvas.fire('annotationimageerror');
  manager.baseManager.onInspectionChange(false);
  assert.equal(status.textContent, 'This image could not be loaded.');
  assert.equal(status.dataset.state, 'error');
});

test('student saving status takes priority over the inspection hint', async () => {
  let finish;
  const response = new Promise(resolve => { finish = resolve; });
  const {elements, manager} = page(response);
  manager.groups.push({label: 'test finding', annotations: [{}]});
  manager.onGroupedAnnotationsChange(); manager.baseManager.onInspectionChange(true);
  const saving = elements['submit-button'].click();
  const status = elements['annotation-status'];
  assert.equal(status.dataset.state, 'saving');
  assert.match(status.textContent, /Saving all groups/);
  manager.baseManager.onInspectionChange(false);
  assert.equal(status.dataset.state, 'saving');
  finish({success: true, redirectUrl: '/Home/Student'});
  await saving;
});

test('real student canvas keeps grouped and selected outlines hidden during inspection redraws', () => {
  let baseDraws = 0;
  const outlined = [];
  class CanvasManager {
    constructor() {
      this.ready = true; this.usingLens = false;
      this.drawCanvas = () => { baseDraws++; };
      this.drawAnnotation = shape => outlined.push(shape);
    }
  }
  const ActualStudentCanvas = vm.runInNewContext(fs.readFileSync(path.join(__dirname,
    '../../src/MedAnnotateApp.Presentation/wwwroot/js/studentCanvas.js'), 'utf8') + '\nStudentCanvasManager',
    {CanvasManager, document: {addEventListener() {}}});
  ActualStudentCanvas.prototype.createFloatingTextBox = () => {};
  ActualStudentCanvas.prototype.setupEventListeners = () => {};
  const manager = new ActualStudentCanvas('canvas', 'image', 'container');
  const groupedShape = {type: 'freehand'}, selectedShape = {type: 'rectangle'};
  manager.groupedAnnotations = [{annotations: [groupedShape]}];
  manager.baseManager.selectedAnnotation = selectedShape;
  manager.baseManager.drawCanvas();
  assert.deepEqual(outlined, [groupedShape, selectedShape]);
  outlined.length = 0;
  manager.baseManager.usingLens = true;
  manager.baseManager.drawCanvas();
  assert.equal(baseDraws, 2, 'The base image redraw still runs during inspection');
  assert.deepEqual(outlined, [], 'Student overlays must remain hidden after resize/redraw');
  manager.baseManager.usingLens = false;
  manager.baseManager.drawCanvas();
  assert.deepEqual(outlined, [groupedShape, selectedShape]);
  assert.equal(manager.groupedAnnotations[0].annotations[0], groupedShape);
  assert.equal(manager.baseManager.selectedAnnotation, selectedShape);
});
