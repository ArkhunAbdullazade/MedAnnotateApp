"use strict";

document.addEventListener("DOMContentLoaded", () => {
  let dirty = false, saving = false, initialized = false;
  const status = document.getElementById("annotation-status");
  let baseStatus = {message: status?.textContent || "", state: status?.dataset.state || "ready"};
  let inspecting = false;
  const renderStatus = () => {
    if (!status) return;
    const hint = inspecting && !["error", "saving"].includes(baseStatus.state);
    status.textContent = hint ? "Inspection only: outlines are temporarily hidden. Drag the lens or its edge. Click Magnifier again to return to drawing." : baseStatus.message;
    status.dataset.state = hint ? "inspection" : baseStatus.state;
  };
  const showStatus = (message, state = "ready") => {
    baseStatus = {message, state};
    renderStatus();
  };
  const inspectionChanged = active => {
    if (active && !inspecting && status) baseStatus = {message: status.textContent, state: status.dataset.state || "ready"};
    inspecting = active;
    renderStatus();
  };
  const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value;
  const headers = { "Content-Type": "application/json", "X-CSRF-TOKEN": token || "" };
  const request = async (url, options = {}) => {
    const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
    let result;
    try { result = await response.json(); } catch { throw new Error("Your session may have expired. Keep this page open and sign in again in another tab before retrying."); }
    if (!response.ok || result.success === false) throw new Error(result.message || "The request could not be saved. Your work is still on this page.");
    return result;
  };
  window.addEventListener("beforeunload", e => {
    if (dirty || saving) { e.preventDefault(); e.returnValue = ""; }
  });
  for (const id of ["end-button", "end-button-center"]) {
    document.getElementById(id)?.addEventListener("click", async () => {
      if (saving) return;
      if (dirty && !confirm("This term has unsaved annotations or comments. Discard them and log out?")) return;
      try {
        await request("/Identity/Logout", {method: "POST", body: JSON.stringify({isAnnotationStarted:window.hasAnnotatedCurrentImage === true,medDataId:window.annotatedMedData?.id})});
        dirty = false;
        location.href = "/Identity/Login";
      } catch (error) { showStatus(error.message, "error"); }
    });
  }
  if (!window.annotatedMedData) return;
  const medData = window.annotatedMedData;
  const assignmentId = medData.id;
  const next = document.getElementById("next-button");
  const skip = document.getElementById("skip-button");
  const absent = document.getElementById("not-present-button");
  const comments = document.getElementById("comments");
  const occurrences = [...document.querySelectorAll(".header-text .keyword")];
  // Repeated phrases share one response; progress follows their first appearance in the text.
  const terms = occurrences.filter((term, index) => occurrences.findIndex(other => other.dataset.keyword === term.dataset.keyword) === index);
  const expectedTermCount = Number(document.querySelector(".header-text")?.dataset.keywordCount || 0);
  const manager = new CanvasManager("mainCanvas", "sourceImage", "canvasContainer");
  window.canvasManager = manager;
  manager.onInspectionChange = inspectionChanged;
  if (status?.dataset.state === "error") showStatus(status.textContent, "error");
  const tools = manager.createTools(document.getElementById("image-container"));
  tools.rectButton.addEventListener("click", () => manager.switchMode("rectangle"));
  tools.freehandButton.addEventListener("click", () => manager.switchMode("freehand"));
  tools.magnifyButton.addEventListener("click", () => manager.switchMode("magnifier"));
  let history = [], currentIndex = -1, reviewIndex = -1;
  let historyLoaded = false, historyLoading = false;
  let started = Date.now(), firstDraw = 0;
  window.setAnnotationStartTime = () => { if (!firstDraw) firstDraw = Date.now(); };
  const termName = i => terms[i]?.dataset.keyword || terms[i]?.textContent.trim();
  const saved = i => history.find(row => row.extractedKeyword === termName(i));
  const pendingIndex = () => terms.findIndex((_, i) => !saved(i));
  function buttons() {
    const complete = initialized && currentIndex === -1;
    next.textContent = complete ? "Next Image" : "Save and Next Term";
    next.disabled = saving || !initialized || !manager.ready || (!complete && (reviewIndex !== -1 || !manager.annotations.length || manager.currentAction !== "none"));
    skip.disabled = absent.disabled = saving || !initialized || !manager.ready || complete || reviewIndex !== -1 || manager.annotations.length > 0;
    comments.disabled = !initialized || !manager.ready || saving || reviewIndex !== -1 || complete;
    manager.readOnly = !initialized || !manager.ready || saving || reviewIndex !== -1 || complete;
    occurrences.forEach(term => {
      const i = terms.findIndex(first => first.dataset.keyword === term.dataset.keyword);
      term.classList.remove("current_keyword", "annotated_keyword", "not_annotated_keyword", "skipped_keyword");
      const row = saved(i);
      term.classList.add(row ? row.pressedButton === "Save and Next Term" ? "annotated_keyword" : "skipped_keyword" : i === currentIndex ? "current_keyword" : "not_annotated_keyword");
      term.setAttribute("aria-pressed", String(i === (reviewIndex === -1 ? currentIndex : reviewIndex)));
    });
  }
  function showCurrent() {
    reviewIndex = -1;
    manager.resetAnnotation(); comments.value = ""; dirty = false;
    currentIndex = pendingIndex(); started = Date.now(); firstDraw = 0;
    buttons();
    showStatus(currentIndex === -1 ? "All terms saved. Select Next Image to continue. You can select a saved term to review it." : `Annotate the current term: ${termName(currentIndex)}. Changes are not saved until you select Save and Next Term.`);
    const current = terms[currentIndex], textBox = current?.closest?.(".header-text");
    if (textBox) {
      const phrase = current.getBoundingClientRect(), box = textBox.getBoundingClientRect();
      if (phrase.top < box.top + 4) textBox.scrollTop -= box.top + 4 - phrase.top;
      else if (phrase.bottom > box.bottom - 4) textBox.scrollTop += phrase.bottom - box.bottom + 4;
    }
  }
  async function initialize() {
    if (initialized || historyLoading) return;
    if (!terms.length || terms.length !== expectedTermCount) {
      showStatus("Some annotation terms could not be found separately in the description. Ask the research team to refine this image's keywords. No responses have been saved.", "error");
      buttons();
      return;
    }
    if (!historyLoaded) {
      historyLoading = true;
      try {
        const result = await request(`/MedData/CurrentAnnotations?medDataId=${encodeURIComponent(assignmentId)}`);
        history = result.annotations || [];
        historyLoaded = true;
        window.hasAnnotatedCurrentImage = history.length > 0;
      } catch (error) { showStatus(error.message, "error"); buttons(); return; }
      finally { historyLoading = false; }
    }
    if (!manager.ready) return;
    initialized = true;
    showCurrent();
  }
  manager.canvas.addEventListener("annotationimageready", initialize);
  manager.canvas.addEventListener("annotationimageerror", () => {
    showStatus(status?.textContent || "This image could not be loaded.", "error");
    buttons();
  });
  manager.onAnnotationsChange = () => {
    if (!manager.readOnly && initialized) {
      dirty = true;
      showStatus("Unsaved changes. Select Save and Next Term to save this term.", "unsaved");
    }
    buttons();
  };
  comments.addEventListener("input", () => { dirty = true; showStatus("Unsaved comment.", "unsaved"); });
  occurrences.forEach(term => {
    const i = terms.findIndex(first => first.dataset.keyword === term.dataset.keyword);
    term.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); term.click(); }
    });
    term.addEventListener("click", () => {
    if (saving || !initialized || !manager.ready) return;
    const record = saved(i);
    if (!record && i !== currentIndex) return;
    if (dirty && !confirm("Discard unsaved changes to review another term?")) return;
    if (!record) { showCurrent(); return; }
    manager.resetAnnotation(); dirty = false; reviewIndex = i; comments.value = record.comment || "";
    const reviewNext = currentIndex < 0 ? "All terms are saved. Select Next Image to continue." : "Select the current term to continue.";
    if (record.boxCoordinates) {
      try { manager.loadCoordinates(record.boxCoordinates); showStatus(`Saved annotation for ${termName(i)} (read only). ${reviewNext}`); }
      catch (error) { showStatus(`This saved response has legacy or changed image coordinates. It is preserved and has not been converted. ${error.message}`, "error"); }
    } else showStatus(`Saved response for ${termName(i)}: ${record.pressedButton}. ${reviewNext}`);
    buttons();
    });
  });
  async function save(action) {
    if (saving || !initialized || !manager.ready || currentIndex < 0 || reviewIndex !== -1 || assignmentId !== window.annotatedMedData.id) return;
    let coordinates = "";
    try { if (action === "Save and Next Term") coordinates = manager.getAllAnnotationsJSON(); }
    catch (error) { showStatus(error.message, "error"); return; }
    const elapsed = firstDraw ? `(${Math.max(0,firstDraw-started)},${Math.max(0,Date.now()-firstDraw)})` : "(0,0)";
    const payload = {Id:assignmentId,BoxCoordinates:coordinates,ExtractedKeyword:termName(currentIndex),PressedButton:action,Comment:comments.value.trim(),Timestamps:elapsed};
    saving = true; buttons(); showStatus("Saving… keep this page open.", "saving");
    try {
      await request("/MedData/ProcessAnnotatedMedData", {method:"POST",body:JSON.stringify(payload)});
      history.push({extractedKeyword:payload.ExtractedKeyword,boxCoordinates:coordinates,pressedButton:action,comment:payload.Comment});
      window.hasAnnotatedCurrentImage = true;
      saving = false; showCurrent();
    } catch (error) { saving = false; buttons(); showStatus(error.message, "error"); }
  }
  next.addEventListener("click", async () => {
    if (saving || !initialized || !manager.ready) return;
    if (currentIndex !== -1) { await save("Save and Next Term"); return; }
    saving = true; buttons(); showStatus("Loading the next image…", "saving");
    try {
      await request(`/MedData/NextImage?medDataId=${encodeURIComponent(assignmentId)}`,{method:"PUT"});
      saving = false; dirty = false; location.reload();
    } catch (error) { saving = false; buttons(); showStatus(error.message,"error"); }
  });
  skip.addEventListener("click", () => save("Uncertain/Skip"));
  absent.addEventListener("click", () => save("Not Visible/Abstract"));
  buttons();
  initialize();
});
