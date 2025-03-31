document.addEventListener("DOMContentLoaded", function () {
  console.log("Student page script loaded");
  
  // Flag to identify student page for canvas.js
  window.isStudentPage = true;
  
  // CRITICAL: Set hasAnnotatedCurrentImage to false by default
  // This must be explicitly defined at the global level
  window.hasAnnotatedCurrentImage = false;
  
  // Handle logout functionality first - this works regardless of which page state we're in
  setupLogoutFunctionality();
  
  // Only proceed with the rest of the initialization if we have data (not the "no more data" screen)
  if (window.annotatedMedData) {
    console.log("Annotation data available, initializing student page");
    initializeStudentPageFunctionality();
  } else {
    console.log("No annotation data available");
  }
});

// Function to setup logout functionality
function setupLogoutFunctionality() {
  // Setup end button (primary logout button)
  const endButton = document.getElementById("end-button");
  if (endButton) {
    endButton.addEventListener("click", handleLogout);
  }

  // Add event listener for center logout button (when no data is available)
  const endButtonCenter = document.getElementById("end-button-center");
  if (endButtonCenter) {
    endButtonCenter.addEventListener("click", handleLogout);
  }
}

// Shared logout handler function
function handleLogout() {
  // Allow some buffer time for the logout operation to complete
  let redirectTimerSet = false;
  
  // Set a fallback timer to ensure redirection happens regardless of API response
  const redirectTimer = setTimeout(() => {
    if (!redirectTimerSet) {
      redirectTimerSet = true;
      window.location.href = "/Identity/Login";
    }
  }, 2000);
  
  console.log("STUDENT PAGE: Always using isAnnotationStarted=false as requested");
  
  // For student page, we always set isAnnotationStarted to false as requested
  const requestData = {
    isAnnotationStarted: false, // Always false for student page
    medDataId: window.annotatedMedData ? window.annotatedMedData.id : null,
    keywordStates: null // No keywordStates for student page
  };
  
  console.log("Logging out with request data:", requestData);
      
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
let annotationLabel;
let addAnnotationLabelBtn;
let imageContainer;
let sourceImage;
let canvasContainer;
let selectedAnnotationIndex = -1;
let canvasManager = null;

// Function to initialize the student page functionality
function initializeStudentPageFunctionality() {
  console.log("Setting up student page functionality");
  
  // ====================================================
  // Global Elements & Setup - same as professional page
  // ====================================================
  submitButton = document.getElementById("submit-button");
  annotationsList = document.getElementById("annotations-list");
  annotationLabel = document.getElementById("annotation-label");
  addAnnotationLabelBtn = document.getElementById("add-annotation-label");
  imageContainer = document.getElementById("image-container");
  sourceImage = document.getElementById("sourceImage");
  canvasContainer = document.getElementById("canvasContainer");
  
  // Initialize timestamp for metrics
  window.tIdentifyStart = Date.now();
  window.tAnnotationStart = 0;
  
  // ====================================================
  // Global Navigation & Storage Variables - simplified for student page
  // ====================================================
  
  // Student page doesn't use keywordStates or hasAnnotatedCurrentImage flags
  // We simply track annotations without these states
  
  console.log("Student page initialized - no keywordStates tracking");
  
  // Set up annotation start time function - still useful for metrics
  window.setAnnotationStartTime = function() {
    if (window.tAnnotationStart === 0) {
      window.tAnnotationStart = Date.now();
    }
  };
  
  // Setup form and button event listeners
  setupAnnotationForm();
  setupSubmitButton();
  
  // Wait for image to load then initialize canvas
  if (sourceImage.complete) {
    initializeCanvas();
  } else {
    sourceImage.onload = initializeCanvas;
  }
}

// Initialize canvas with exact same approach as professional page
function initializeCanvas() {
  console.log("Initializing canvas...");
  
  try {
    // Initialize CanvasManager - identical to professional page
    canvasManager = new CanvasManager("mainCanvas", "sourceImage", "canvasContainer");
    console.log("Canvas manager created");
    
    // Store canvas manager globally
    window.canvasManager = canvasManager;
    
    // Check if we already have annotations and set hasAnnotatedCurrentImage accordingly
    setTimeout(function() {
      const annotations = canvasManager.getAnnotations();
      if (annotations && annotations.length > 0) {
        window.hasAnnotatedCurrentImage = true;
        console.log("initializeCanvas: Found existing annotations, setting hasAnnotatedCurrentImage to true");
      }
    }, 100);
    
    // Create tool buttons - identical to professional page
    const { rectButton, freehandButton, magnifyButton } = canvasManager.createTools(imageContainer);
    console.log("Tool buttons created");
    
    // Setup tool button event listeners - identical to professional page
    rectButton.addEventListener("click", () => canvasManager.switchMode("rectangle"));
    freehandButton.addEventListener("click", () => canvasManager.switchMode("freehand"));
    magnifyButton.addEventListener("click", function(e) {
      canvasManager.switchMode("magnifier");
      e.stopPropagation();
    });
    
    // Initialize canvas callbacks for annotation changes
    canvasManager.onAnnotationsChange = function() {
      console.log("Annotations changed");
      const annotations = canvasManager.getAnnotations();
      
      // Record annotation time for the first annotation - this is still useful for metrics
      if (window.tAnnotationStart === 0) {
        window.tAnnotationStart = Date.now();
        // This ensures we track the first annotation time correctly
        window.setAnnotationStartTime();
      }
      
      // Student page doesn't use keywordStates or hasAnnotatedCurrentImage
      // We only need to update the UI elements
      
      // Set the selected annotation to the most recent one
      if (annotations.length > 0) {
        selectedAnnotationIndex = annotations.length - 1;
        annotationLabel.value = annotations[selectedAnnotationIndex].label || "";
        addAnnotationLabelBtn.disabled = !annotationLabel.value.trim();
        annotationLabel.focus();
      }
      
      // Update UI
      updateAnnotationsList();
      updateButtonState();
    };
    
    // Initialize UI
    updateAnnotationsList();
    updateButtonState();
    
    console.log("Canvas initialization complete");
  } catch (error) {
    console.error("Error initializing canvas:", error);
  }
}

// ====================================================
// Annotation Form Setup
// ====================================================
function setupAnnotationForm() {
  console.log("Setting up annotation form");
  // Add event listener for annotation label input
  annotationLabel.addEventListener("input", function() {
    addAnnotationLabelBtn.disabled = !annotationLabel.value.trim() || selectedAnnotationIndex === -1;
  });
  
  // Add event listener for add annotation label button
  addAnnotationLabelBtn.addEventListener("click", function() {
    if (!canvasManager) return;
    
    if (selectedAnnotationIndex !== -1) {
      const annotations = canvasManager.getAnnotations();
      const labelText = annotationLabel.value.trim();
      
      if (labelText && selectedAnnotationIndex < annotations.length) {
        // Create a new annotations array with the updated label
        const updatedAnnotations = annotations.map((ann, i) => {
          if (i === selectedAnnotationIndex) {
            return { ...ann, label: labelText };
          }
          return ann;
        });
        
        // Update annotations
        canvasManager.setAnnotations(updatedAnnotations);
        
        // Reset input
        annotationLabel.value = "";
        selectedAnnotationIndex = -1;
        addAnnotationLabelBtn.disabled = true;
        
        // Update UI
        updateAnnotationsList();
        updateButtonState();
      }
    }
  });
}

// ====================================================
// Submit Button Setup
// ====================================================
function setupSubmitButton() {
  console.log("Setting up submit button");
  submitButton.addEventListener("click", function() {
    if (!canvasManager) return;
    
    const annotations = canvasManager.getAnnotations();
    
    // Only proceed if there are annotations
    if (annotations.length === 0) {
      alert("Please add at least one annotation before submitting.");
      return;
    }
    
    // Check if there are any unlabeled annotations
    const hasUnlabeledAnnotations = annotations.some(ann => !ann.label || ann.label.trim() === "");
    if (hasUnlabeledAnnotations) {
      if (!confirm("Some annotations don't have labels. Submit anyway?")) {
        return;
      }
    }
    
    console.log("STUDENT PAGE: Always using isAnnotationStarted=false as requested");
    
    // Gather all the annotation data
    const medData = window.annotatedMedData;
    
    // Create a list of annotation DTOs
    const annotationDtos = annotations.map(ann => {
      // Get the coordinates for this specific annotation
      const coordinates = canvasManager.getAnnotationCoordinatesJSON(ann);
      
      return {
        // Basic metadata from the original MedData
        Id: medData.id,
        ImageUrl: medData.imageUrl,
        ImageDescription: medData.imageDescription,
        
        // Demographics data
        Sex: medData.sex || "",
        Age: medData.age || "",
        BodyRegion: medData.bodyRegion || "",
        Diagnosis: medData.diagnosis || "",
        TreatmentName: medData.treatmentName || "",
        Speciality: medData.speciality || "",
        Modality: medData.modality || "",
        
        // Individual annotation data
        Coordinates: JSON.stringify(coordinates),
        TextualAnnotation: ann.label || `Annotation ${annotations.indexOf(ann) + 1}`,
      };
    });
    
    // Create the final object to send to the server
    const submissionData = {
      Annotations: annotationDtos,
      KeywordStates: null,  // No keyword states for student page
      IsAnnotationStarted: false  // Always false for student page
    };
    
    console.log("Final submission data:", JSON.stringify(submissionData));
    
    // Show loading state
    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";
    
    // Send the data to the server using the endpoint
    fetch('/MedData/SubmitStudentAnnotations', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submissionData),
    })
    .then((response) => response.json())
    .then((result) => {
      if (result.success) {
        // Navigate to the next page - wait a moment to ensure data is processed
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
function updateButtonState() {
  if (!canvasManager) return;
  
  const annotations = canvasManager.getAnnotations();
  submitButton.disabled = annotations.length === 0;
  addAnnotationLabelBtn.disabled = !annotationLabel.value.trim() || selectedAnnotationIndex === -1;
}

function updateAnnotationsList() {
  if (!canvasManager) return;
  
  // Clear the annotations list
  annotationsList.innerHTML = "";
  
  const annotations = canvasManager.getAnnotations();
  
  // Student page doesn't use keywordStates or hasAnnotatedCurrentImage
  // This function only updates the annotations list UI
  
  if (annotations.length === 0) {
    // Show empty message
    const emptyMessage = document.createElement("div");
    emptyMessage.className = "empty-annotations-message";
    emptyMessage.textContent = "No annotations yet. Use the tools to annotate the image.";
    annotationsList.appendChild(emptyMessage);
    return;
  }
  
  // Add each annotation to the list
  annotations.forEach((annotation, index) => {
    const annotationItem = document.createElement("div");
    annotationItem.className = "annotation-item";
    annotationItem.dataset.index = index;
    
    // Create annotation type
    const typeSpan = document.createElement("span");
    typeSpan.className = "annotation-type";
    typeSpan.textContent = annotation.type === "rectangle" ? "Rectangle" : "Freehand";
    
    // Create annotation label
    const labelSpan = document.createElement("span");
    labelSpan.className = "annotation-label";
    labelSpan.textContent = annotation.label || `Annotation ${index + 1}`;
    
    // Create annotation actions
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "annotation-actions";
    
    // Create edit button
    const editButton = document.createElement("button");
    editButton.textContent = "Edit";
    editButton.addEventListener("click", function() {
      selectedAnnotationIndex = index;
      annotationLabel.value = annotation.label || "";
      annotationLabel.focus();
      addAnnotationLabelBtn.disabled = !annotationLabel.value.trim();
    });
    
    // Create delete button
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", function() {
      const newAnnotations = canvasManager.getAnnotations().filter((_, i) => i !== index);
      canvasManager.setAnnotations(newAnnotations);
      
      // Update UI
      updateAnnotationsList();
      updateButtonState();
      
      // Reset selected annotation if we deleted it
      if (selectedAnnotationIndex === index) {
        selectedAnnotationIndex = -1;
        annotationLabel.value = "";
        addAnnotationLabelBtn.disabled = true;
      } else if (selectedAnnotationIndex > index) {
        // Adjust index if we deleted an annotation before the selected one
        selectedAnnotationIndex--;
      }
    });
    
    // Assemble the annotation item
    actionsDiv.appendChild(editButton);
    actionsDiv.appendChild(deleteButton);
    annotationItem.appendChild(typeSpan);
    annotationItem.appendChild(labelSpan);
    annotationItem.appendChild(actionsDiv);
    annotationsList.appendChild(annotationItem);
  });
}

// Add a window.onload handler to ensure correct sizing and initialization
window.onload = function() {
  // If we have a canvas manager, update tools position to match professional page
  if (window.canvasManager) {
    // Handle window resize events
    window.addEventListener('resize', function() {
      if (window.canvasManager && window.canvasManager.updateToolsPosition) {
        window.canvasManager.updateToolsPosition(document.getElementById("image-container"));
      }
    });
    
    // Handle scroll events
    document.addEventListener('scroll', function() {
      if (window.canvasManager && window.canvasManager.updateToolsPosition) {
        window.canvasManager.updateToolsPosition(document.getElementById("image-container"));
      }
    });
    
    // Force a redraw to ensure everything is rendered correctly
    window.canvasManager.drawCanvas();
    
    // Force the image to reload if needed
    const sourceImage = document.getElementById('sourceImage');
    if (sourceImage && !sourceImage.complete) {
      sourceImage.onload = function() {
        // Re-trigger the canvas manager's image load handler
        if (window.canvasManager && window.canvasManager.sourceImage) {
          window.canvasManager.sourceImage.onload();
        }
      };
    } else if (window.canvasManager && window.canvasManager.sourceImage) {
      // Image already loaded, manually trigger the onload handler
      window.canvasManager.sourceImage.onload();
    }
  }
};

function submitAnnotations() {
  // Create annotations array to send to server
  const annotations = canvasManager.getAnnotations();
  console.log("Annotations to be submitted:", annotations);
  
  // Get the annotation DTOs
  const annotationDtos = getAnnotationCoordinatesJSON();
  console.log("AnnotationDTOs to be submitted:", annotationDtos);
  
  // Disable the button during submission
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";
  
  // Show loading indicator
  document.getElementById("loadingOverlay").style.display = "flex";
  
  // Submit annotations to the server - with isAnnotationStarted always false
  fetch('/Home/SubmitAnnotationsAsync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      Annotations: annotationDtos,
      KeywordStates: null,  // No keyword states for student page
      IsAnnotationStarted: false  // Always false for student page
    }),
  })
  // ... existing code ...
}
