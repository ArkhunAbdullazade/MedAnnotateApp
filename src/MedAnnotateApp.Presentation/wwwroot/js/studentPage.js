"use strict";

document.addEventListener("DOMContentLoaded", () => {
  let dirty = false, saving = false, navigating = false, manager;
  const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value || "";
  const headers = {"Content-Type":"application/json","X-CSRF-TOKEN":token};
  const status = document.getElementById("annotation-status");
  const showStatus = (text, state="ready") => { if (status) {status.textContent=text;status.dataset.state=state;} };
  const hasUnsavedWork=()=>manager ? manager.getAnnotationGroups().length>0 || manager.baseManager.annotations.length>0 || manager.baseManager.currentAction!=="none" : dirty;
  window.addEventListener("beforeunload", e => {if(!navigating && (hasUnsavedWork() || saving)){e.preventDefault();e.returnValue="";}});
  for (const id of ["end-button","end-button-center"]) document.getElementById(id)?.addEventListener("click", async () => {
    if (saving || (hasUnsavedWork() && !confirm("Discard all unsubmitted annotations and log out?"))) return;
    try {
      const response = await fetch("/Identity/Logout",{method:"POST",headers,body:JSON.stringify({isAnnotationStarted:false,medDataId:window.annotatedMedData?.id})});
      if (!response.ok) throw new Error("Logout failed. Your work is still on this page. Please try again.");
      dirty=false;navigating=true; location.href="/Identity/Login";
    } catch (error) { showStatus(error.message,"error"); }
  });
  if (!window.annotatedMedData) return;
  const imageId=window.annotatedMedData.id;
  const submit=document.getElementById("submit-button");
  const list=document.getElementById("annotations-list");
  manager=window.canvasManager=new StudentCanvasManager("mainCanvas","sourceImage","canvasContainer");
  const tools=manager.createTools(document.getElementById("image-container"));
  tools.rectButton.addEventListener("click",()=>manager.switchMode("rectangle"));
  tools.freehandButton.addEventListener("click",()=>manager.switchMode("freehand"));
  tools.magnifyButton.addEventListener("click",()=>manager.switchMode("magnifier"));
  function updateList() {
    list.replaceChildren();
    const groups=manager.getAnnotationGroups();
    submit.disabled=saving || !manager.baseManager.ready || groups.length===0;
    if (!groups.length) {
      const empty=document.createElement("p");empty.className="empty-annotations-message";empty.textContent="Draw a shape, enter a label, then save the group. Submit all groups when finished.";list.appendChild(empty);
    }
    groups.forEach((group,index)=>{
      const item=document.createElement("div");item.className="annotation-item";
      const label=document.createElement("span");label.className="annotation-label";label.textContent=`${group.label} (${group.annotations.length} shape${group.annotations.length===1?"":"s"})`;
      const actions=document.createElement("div");actions.className="annotation-actions";
      const edit=document.createElement("button");edit.type="button";edit.textContent="Edit";edit.disabled=saving;
      edit.addEventListener("click",()=>{if(!saving)manager.editGroup(index);});
      const remove=document.createElement("button");remove.type="button";remove.textContent="Delete";remove.disabled=saving;
      remove.addEventListener("click",()=>{if(!saving && confirm("Delete this annotation group?"))manager.deleteGroup(index);});
      actions.append(edit,remove);item.append(label,actions);list.appendChild(item);
    });
  }
  function updateDraftState() {
    const pending=manager.baseManager.annotations.length>0 || manager.baseManager.currentAction!=="none";
    dirty=hasUnsavedWork();updateList();
    showStatus(pending ? "Unsaved shape changes. Enter a label and save this group before submitting." : dirty ?
      "Groups are held on this page. Select Submit Annotations to save them to the database." :
      "Image ready. Draw a shape, label it and save the group.",dirty ? "unsaved" : "ready");
  }
  manager.onGroupedAnnotationsChange=updateDraftState;
  const original=manager.baseManager.onAnnotationsChange;
  manager.baseManager.onAnnotationsChange=()=>{original();updateDraftState();};
  manager.baseManager.canvas.addEventListener("annotationimageready",()=>{updateList();showStatus("Image ready. Draw a shape, label it and save the group.");});
  manager.baseManager.canvas.addEventListener("annotationimageerror",updateList);
  if(manager.baseManager.ready)showStatus("Image ready. Draw a shape, label it and save the group.");
  submit.addEventListener("click",async()=>{
    if(saving || !manager.baseManager.ready || imageId!==window.annotatedMedData.id)return;
    if(manager.baseManager.currentAction!=="none" || manager.baseManager.annotations.length){showStatus("Finish and save or cancel the current group before submitting.","error");return;}
    const groups=manager.getAnnotationGroups();
    if(!groups.length || groups.some(g=>!g.label?.trim())){showStatus("Every group needs a label and at least one complete shape.","error");return;}
    let payload;
    try {
      payload={Annotations:manager.getAllGroupedAnnotationsJSON().map(group=>({Id:imageId,Coordinates:group.annotations,TextualAnnotation:group.label}))};
    } catch(error){showStatus(error.message,"error");return;}
    saving=true;manager.baseManager.readOnly=true;submit.textContent="Submitting…";updateList();showStatus("Saving all groups… keep this page open.","saving");
    try {
      const response=await fetch("/MedData/SubmitStudentAnnotations",{method:"POST",headers,body:JSON.stringify(payload)});
      let result;try{result=await response.json();}catch{throw new Error("Your session may have expired. Sign in in another tab and retry; keep this page open.");}
      if(!response.ok || !result.success)throw new Error(result.message || "Save failed. All groups are still on this page.");
      dirty=false;saving=false;navigating=true;location.href=result.redirectUrl || "/Home/Student";
    } catch(error){saving=false;manager.baseManager.readOnly=false;submit.textContent="Submit Annotations";updateList();showStatus(error.message,"error");}
  });
  updateList();
});
