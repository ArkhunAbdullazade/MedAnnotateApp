document.addEventListener("DOMContentLoaded", function () {
  // Flag to identify student page for canvas.js
  window.isStudentPage = true;
  window.hasAnnotatedCurrentImage = false;

  setupLogoutFunctionality();

  if (window.annotatedMedData) {
    initializeStudentPageFunctionality();
  }
});

function setupLogoutFunctionality() {
  const endButton = document.getElementById("end-button");
  if (endButton) {
    endButton.addEventListener("click", handleLogout);
  }

  const endButtonCenter = document.getElementById("end-button-center");
  if (endButtonCenter) {
    endButtonCenter.addEventListener("click", handleLogout);
  }
}

function handleLogout() {
  let redirectTimerSet = false;

  const redirectTimer = setTimeout(() => {
    if (!redirectTimerSet) {
      redirectTimerSet = true;
      window.location.href = "/Identity/Login";
    }
  }, 2000);

  const requestData = {
    isAnnotationStarted: false,
    medDataId: window.annotatedMedData ? window.annotatedMedData.id : null
  };
      
  fetch('/Identity/Logout', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestData),
  })
  .then((response) => response.json())
  .then((result) => {
    clearTimeout(redirectTimer);
    redirectTimerSet = true;
    window.location.href = "/Identity/Login";
  })
  .catch((error) => {
    console.error("Error:", error);
    if (!redirectTimerSet) {
      redirectTimerSet = true;
      window.location.href = "/Identity/Login";
    }
  });
}

// Global variables to hold page elements
let submitButton;
let annotationsList;
let imageContainer;
let sourceImage;
let canvasContainer;
let studentCanvasManager = null;

function initializeStudentPageFunctionality() {
  submitButton = document.getElementById("submit-button");
  annotationsList = document.getElementById("annotations-list");
  imageContainer = document.getElementById("image-container");
  sourceImage = document.getElementById("sourceImage");
  canvasContainer = document.getElementById("canvasContainer");

  window.tIdentifyStart = Date.now();
  window.tAnnotationStart = 0;

  window.setAnnotationStartTime = function() {
    if (window.tAnnotationStart === 0) {
      window.tAnnotationStart = Date.now();
    }
  };

  if (sourceImage.complete) {
    initializeCanvas();
  } else {
    sourceImage.onload = initializeCanvas;
  }
}

function initializeCanvas() {
  try {
    studentCanvasManager = new StudentCanvasManager("mainCanvas", "sourceImage", "canvasContainer");
    window.canvasManager = studentCanvasManager;

    const { rectButton, freehandButton, magnifyButton } = studentCanvasManager.createTools(imageContainer);

    rectButton.addEventListener("click", () => studentCanvasManager.switchMode("rectangle"));
    freehandButton.addEventListener("click", () => studentCanvasManager.switchMode("freehand"));
    magnifyButton.addEventListener("click", function(e) {
      studentCanvasManager.switchMode("magnifier");
      e.stopPropagation();
    });

    studentCanvasManager.onGroupedAnnotationsChange = updateAnnotationsList;

    updateAnnotationsList();
    setupSubmitButton();
  } catch (error) {
    console.error("Error initializing canvas:", error);
  }
}

// ====================================================
// Submit Button Setup
// ====================================================
function setupSubmitButton() {
  submitButton.addEventListener("click", function() {
    if (!studentCanvasManager) return;

    const annotationGroups = studentCanvasManager.getAnnotationGroups();

    if (annotationGroups.length === 0) {
      alert("Please add at least one annotation before submitting.");
      return;
    }

    const hasUnlabeledGroups = annotationGroups.some(group => !group.label || group.label.trim() === "");
    if (hasUnlabeledGroups) {
      if (!confirm("Some annotations don't have labels. Submit anyway?")) {
        return;
      }
    }

    const medData = window.annotatedMedData;
    const groupedAnnotationsJSON = studentCanvasManager.getAllGroupedAnnotationsJSON();
    const annotationDtos = [];

    groupedAnnotationsJSON.forEach(group => {
      annotationDtos.push({
        Id: medData.id,
        ImageUrl: medData.imageUrl,
        ImageDescription: medData.imageDescription,

        Sex: medData.sex || "",
        Age: medData.age || "",
        BodyRegion: medData.bodyRegion || "",
        Diagnosis: medData.diagnosis || "",
        TreatmentName: medData.treatmentName || "",
        Speciality: medData.speciality || "",
        Modality: medData.modality || "",
        
        // Group annotation data
        Coordinates: JSON.stringify(group.annotations),
        TextualAnnotation: group.label || `Annotation ${annotationDtos.length + 1}`,
        GroupId: group.groupId
      });
    });

    const submissionData = {
      Annotations: annotationDtos,
      IsAnnotationStarted: false
    };

    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    fetch('/MedData/SubmitStudentAnnotations', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submissionData),
    })
    .then((response) => response.json())
    .then((result) => {
      if (result.success) {
        setTimeout(() => {
          window.location.href = result.redirectUrl || "/Home/Student";
        }, 500);
      } else {
        alert(result.message || "Failed to submit annotations. Please try again.");
        submitButton.disabled = false;
        submitButton.textContent = "Submit Annotations";
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("An error occurred while submitting annotations. Please try again.");
      submitButton.disabled = false;
      submitButton.textContent = "Submit Annotations";
    });
  });
}

// ====================================================
// UI Update Functions
// ====================================================
function updateAnnotationsList() {
  if (!studentCanvasManager) return;

  annotationsList.replaceChildren();

  const annotationGroups = studentCanvasManager.getAnnotationGroups();
  submitButton.disabled = annotationGroups.length === 0;

  if (annotationGroups.length === 0) {
    const emptyMessage = document.createElement("div");
    emptyMessage.className = "empty-annotations-message";
    emptyMessage.textContent = "No annotations yet. Use the tools to annotate the image.";
    annotationsList.appendChild(emptyMessage);
    return;
  }

  annotationGroups.forEach((group, index) => {
    const annotationItem = document.createElement("div");
    annotationItem.className = "annotation-item";
    annotationItem.dataset.index = index;

    if (studentCanvasManager.selectedGroupIndex === index) {
      annotationItem.classList.add("selected");
    }

    const infoDiv = document.createElement("div");
    infoDiv.className = "annotation-info";

    const colorIndicator = document.createElement("span");
    colorIndicator.className = "annotation-color-indicator";
    colorIndicator.style.backgroundColor = group.color;
    infoDiv.appendChild(colorIndicator);

    const labelSpan = document.createElement("span");
    labelSpan.className = "annotation-label";
    labelSpan.textContent = group.label || `Annotation ${index + 1}`;
    infoDiv.appendChild(labelSpan);

    if (group.annotations.length > 1) {
      const countBadge = document.createElement("span");
      countBadge.className = "annotation-count";
      countBadge.textContent = group.annotations.length;
      annotationItem.appendChild(countBadge);
    }

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "annotation-actions";

    const editButton = document.createElement("button");
    editButton.textContent = "Edit";
    editButton.addEventListener("click", function(e) {
      e.stopPropagation();
      studentCanvasManager.editGroup(index);
      updateAnnotationsList();
    });

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", function(e) {
      e.stopPropagation();
      if (confirm("Are you sure you want to delete this annotation?")) {
        studentCanvasManager.deleteGroup(index);
      }
    });

    annotationItem.addEventListener("click", function() {
      studentCanvasManager.editGroup(index);
      updateAnnotationsList();
    });

    actionsDiv.appendChild(editButton);
    actionsDiv.appendChild(deleteButton);
    annotationItem.appendChild(infoDiv);
    annotationItem.appendChild(actionsDiv);
    annotationsList.appendChild(annotationItem);
  });
}

// Keep canvas tools aligned after the full page layout settles.
window.addEventListener("load", function() {
  if (window.canvasManager) {
    window.addEventListener('resize', function() {
      if (window.canvasManager && window.canvasManager.updateToolsPosition) {
        window.canvasManager.updateToolsPosition(document.getElementById("image-container"));
      }
    });

    document.addEventListener('scroll', function() {
      if (window.canvasManager && window.canvasManager.updateToolsPosition) {
        window.canvasManager.updateToolsPosition(document.getElementById("image-container"));
      }
    });

    if (window.canvasManager.drawCanvas) {
      window.canvasManager.drawCanvas();
    }

    const sourceImage = document.getElementById('sourceImage');
    if (sourceImage && !sourceImage.complete) {
      sourceImage.onload = function() {
        if (window.canvasManager && window.canvasManager.sourceImage) {
          window.canvasManager.sourceImage.onload();
        }
      };
    } else if (window.canvasManager.baseManager && window.canvasManager.baseManager.sourceImage) {
      window.canvasManager.baseManager.sourceImage.onload();
    }
  }
});
