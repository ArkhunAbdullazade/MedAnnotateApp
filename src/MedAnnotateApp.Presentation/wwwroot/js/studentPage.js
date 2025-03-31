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
  
  // For student page, we always set isAnnotationStarted to false
  const requestData = {
    isAnnotationStarted: false, // Always false for student page
    medDataId: window.annotatedMedData ? window.annotatedMedData.id : null
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
let imageContainer;
let sourceImage;
let canvasContainer;
let studentCanvasManager = null;

// Function to initialize the student page functionality
function initializeStudentPageFunctionality() {
  console.log("Setting up student page functionality");
  
  // ====================================================
  // Global Elements & Setup - same as professional page
  // ====================================================
  submitButton = document.getElementById("submit-button");
  annotationsList = document.getElementById("annotations-list");
  imageContainer = document.getElementById("image-container");
  sourceImage = document.getElementById("sourceImage");
  canvasContainer = document.getElementById("canvasContainer");
  
  // Initialize timestamp for metrics
  window.tIdentifyStart = Date.now();
  window.tAnnotationStart = 0;
  
  // Student page doesn't use hasAnnotatedCurrentImage flag
  console.log("Student page initialized");
  
  // Set up annotation start time function - still useful for metrics
  window.setAnnotationStartTime = function() {
    if (window.tAnnotationStart === 0) {
      window.tAnnotationStart = Date.now();
    }
  };
  
  // Wait for image to load then initialize canvas
  if (sourceImage.complete) {
    initializeCanvas();
  } else {
    sourceImage.onload = initializeCanvas;
  }
}

// Initialize canvas with the StudentCanvasManager
function initializeCanvas() {
  console.log("Initializing student canvas...");
  
  try {
    // Initialize StudentCanvasManager instead of base CanvasManager
    studentCanvasManager = new StudentCanvasManager("mainCanvas", "sourceImage", "canvasContainer");
    console.log("Student canvas manager created");
    
    // Store canvas manager globally
    window.canvasManager = studentCanvasManager;
    
    // Create tool buttons - identical to professional page
    const { rectButton, freehandButton, magnifyButton } = studentCanvasManager.createTools(imageContainer);
    console.log("Tool buttons created");
    
    // Setup tool button event listeners - identical to professional page
    rectButton.addEventListener("click", () => studentCanvasManager.switchMode("rectangle"));
    freehandButton.addEventListener("click", () => studentCanvasManager.switchMode("freehand"));
    magnifyButton.addEventListener("click", function(e) {
      studentCanvasManager.switchMode("magnifier");
      e.stopPropagation();
    });
    
    // Set up the callback for when grouped annotations change
    studentCanvasManager.onGroupedAnnotationsChange = updateAnnotationsList;
    
    // Initialize UI
    updateAnnotationsList();
    setupSubmitButton();
    
    console.log("Canvas initialization complete");
  } catch (error) {
    console.error("Error initializing canvas:", error);
  }
}

// ====================================================
// Submit Button Setup
// ====================================================
function setupSubmitButton() {
  console.log("Setting up submit button");
  submitButton.addEventListener("click", function() {
    if (!studentCanvasManager) return;
    
    const annotationGroups = studentCanvasManager.getAnnotationGroups();
    
    // Only proceed if there are annotation groups
    if (annotationGroups.length === 0) {
      alert("Please add at least one annotation before submitting.");
      return;
    }
    
    // Check if there are any unlabeled annotation groups
    const hasUnlabeledGroups = annotationGroups.some(group => !group.label || group.label.trim() === "");
    if (hasUnlabeledGroups) {
      if (!confirm("Some annotations don't have labels. Submit anyway?")) {
        return;
      }
    }
    
    // Gather all the annotation data from groups
    const medData = window.annotatedMedData;
    
    // Get the JSON data for all annotation groups
    const groupedAnnotationsJSON = studentCanvasManager.getAllGroupedAnnotationsJSON();
    
    // Create annotation DTOs from each group
    const annotationDtos = [];
    
    groupedAnnotationsJSON.forEach(group => {
      // Create one DTO per group, combining all annotations in the group
      annotationDtos.push({
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
        
        // Group annotation data
        Coordinates: JSON.stringify(group.annotations),
        TextualAnnotation: group.label || `Annotation ${annotationDtos.length + 1}`,
        GroupId: group.groupId
      });
    });
    
    // Create the final object to send to the server
    const submissionData = {
      Annotations: annotationDtos,
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
function updateAnnotationsList() {
  if (!studentCanvasManager) return;
  
  // Clear the annotations list
  annotationsList.innerHTML = "";
  
  // Get all annotation groups
  const annotationGroups = studentCanvasManager.getAnnotationGroups();
  
  // Update submit button state
  submitButton.disabled = annotationGroups.length === 0;
  
  if (annotationGroups.length === 0) {
    // Show empty message
    const emptyMessage = document.createElement("div");
    emptyMessage.className = "empty-annotations-message";
    emptyMessage.textContent = "No annotations yet. Use the tools to annotate the image.";
    annotationsList.appendChild(emptyMessage);
    return;
  }
  
  // Add each annotation group to the list
  annotationGroups.forEach((group, index) => {
    const annotationItem = document.createElement("div");
    annotationItem.className = "annotation-item";
    annotationItem.dataset.index = index;
    
    // Add selected class if this group is currently being edited
    if (studentCanvasManager.selectedGroupIndex === index) {
      annotationItem.classList.add("selected");
    }
    
    // Create annotation info container
    const infoDiv = document.createElement("div");
    infoDiv.className = "annotation-info";
    
    // Create color indicator
    const colorIndicator = document.createElement("span");
    colorIndicator.className = "annotation-color-indicator";
    colorIndicator.style.backgroundColor = group.color;
    infoDiv.appendChild(colorIndicator);
    
    // Create annotation label
    const labelSpan = document.createElement("span");
    labelSpan.className = "annotation-label";
    labelSpan.textContent = group.label || `Annotation ${index + 1}`;
    infoDiv.appendChild(labelSpan);
    
    // If there's more than one annotation in the group, add a counter badge
    if (group.annotations.length > 1) {
      const countBadge = document.createElement("span");
      countBadge.className = "annotation-count";
      countBadge.textContent = group.annotations.length;
      annotationItem.appendChild(countBadge);
    }
    
    // Create annotation actions
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "annotation-actions";
    
    // Create edit button
    const editButton = document.createElement("button");
    editButton.textContent = "Edit";
    editButton.addEventListener("click", function(e) {
      e.stopPropagation(); // Prevent item click
      studentCanvasManager.editGroup(index);
      updateAnnotationsList(); // Refresh to show selection
    });
    
    // Create delete button
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", function(e) {
      e.stopPropagation(); // Prevent item click
      if (confirm("Are you sure you want to delete this annotation?")) {
        studentCanvasManager.deleteGroup(index);
        // updateAnnotationsList will be called by onGroupedAnnotationsChange
      }
    });
    
    // Make the whole item clickable to edit the group
    annotationItem.addEventListener("click", function() {
      studentCanvasManager.editGroup(index);
      updateAnnotationsList(); // Refresh to show selection
    });
    
    // Assemble the annotation item
    actionsDiv.appendChild(editButton);
    actionsDiv.appendChild(deleteButton);
    annotationItem.appendChild(infoDiv);
    annotationItem.appendChild(actionsDiv);
    annotationsList.appendChild(annotationItem);
  });
}

// Add a window.onload handler to ensure correct sizing and initialization
window.onload = function() {
  // If we have a canvas manager, update tools position
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
    if (window.canvasManager.drawCanvas) {
      window.canvasManager.drawCanvas();
    }
    
    // Force the image to reload if needed
    const sourceImage = document.getElementById('sourceImage');
    if (sourceImage && !sourceImage.complete) {
      sourceImage.onload = function() {
        // Re-trigger the canvas manager's image load handler
        if (window.canvasManager && window.canvasManager.sourceImage) {
          window.canvasManager.sourceImage.onload();
        }
      };
    } else if (window.canvasManager.baseManager && window.canvasManager.baseManager.sourceImage) {
      // Image already loaded, manually trigger the onload handler for StudentCanvasManager
      window.canvasManager.baseManager.sourceImage.onload();
    }
  }
};
