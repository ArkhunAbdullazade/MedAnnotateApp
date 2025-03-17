document.addEventListener('DOMContentLoaded', function () {
  /***********************
   * Global Elements & Setup
   ***********************/
  const canvas = document.getElementById('mainCanvas');
  const ctx = canvas.getContext('2d');
  const sourceImage = document.getElementById('sourceImage'); // fixed image src
  const container = document.getElementById('canvasContainer');
  const magnifyToggle = document.getElementById('magnifyToggle');
  const nextButton = document.getElementById('next-button'); // initially "Save and Next Term"
  const skipButton = document.getElementById('skip-button'); // "Uncertain/Skip"
  const notPresentButton = document.getElementById('not-present-button'); // "Not Visible/Abstract"
  const endButton = document.getElementById('end-button');
  const keywords = document.querySelectorAll('.keyword');
  
  // Global array to accumulate keyword annotations.
  let allKeywordAnnotations = [];

  // In-memory keyword states: 1 = not annotated, 2 = annotated, 3 = current, 4 = skipped.
  // Initially, the first keyword is current (3) and the rest are not annotated (1).
  let keywordStates = Array.from({ length: keywords.length }, (_, i) => (i === 0 ? 3 : 1));

  // Update keyword UI initially.
  for (let i = 0; i < keywords.length; i++) {
    let curr = keywords[i];
    curr.classList.remove('current_keyword', 'annotated_keyword', 'not_annotated_keyword', 'skipped_keyword');
    if (keywordStates[i] === 1) {
      curr.classList.add('not_annotated_keyword');
    } else if (keywordStates[i] === 2) {
      curr.classList.add('annotated_keyword');
    } else if (keywordStates[i] === 3) {
      curr.classList.add('current_keyword');
    } else if (keywordStates[i] === 4) {
      curr.classList.add('skipped_keyword');
    }
  }
  
  // Global timestamp variables.
  // tIdentifyStart: when a keyword becomes current.
  // tAnnotationStart: when the clinician first clicks on the image for that keyword.
  let tIdentifyStart = Date.now();
  let tAnnotationStart = 0;
  
  // Helper: update keyword button states.
  function updateKeywordButtonStates() {
    if (keywordStates.every(state => state === 2 || state === 4)) {
      nextButton.textContent = "Next Image";
      nextButton.disabled = false;
      skipButton.disabled = true;
      notPresentButton.disabled = true;
    }
  }
  
  /***********************
   * Annotation Variables
   ***********************/
  let annotations = [];         // Array of annotation objects: { cx, cy, width, height, rotation }
  let selectedAnnotation = null;
  let currentMode = 'none';     // Modes: 'none', 'draw', 'move', 'resize', 'rotate'
  let activeHandle = null;      // For resizing: which handle is active
  let startX = 0, startY = 0;     // For drawing or moving an annotation
  let offset = { x: 0, y: 0 };    // For moving annotation
  let resizingFixedCorner = null; // For resizing: the fixed (opposite) corner
  let originalMouseAngle = 0, originalAnnotationRotation = 0;
  let currentDrawingAnnotation = null; // Temporary annotation while drawing
  
  // Timing variables.
  let startToDrawEnd = 0;
  let isFirstDraw = true;
  
  /***********************
   * Utility Functions
   ***********************/
  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }
  
  /***********************
   * Canvas & Image Sizing
   ***********************/
  sourceImage.onload = function () {
    canvas.height = 470;
    canvas.width = sourceImage.naturalWidth * (470 / sourceImage.naturalHeight);
    container.style.width = canvas.width + 'px';
    container.style.height = canvas.height + 'px';
    drawCanvas();
  };
  if (sourceImage.complete) {
    sourceImage.onload();
  }
  
  /***********************
   * Drawing Functions
   ***********************/
  function drawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
    annotations.forEach(ann => {
      drawAnnotation(ann, ann === selectedAnnotation);
    });
    if (currentMode === 'draw' && currentDrawingAnnotation) {
      drawAnnotation(currentDrawingAnnotation, true);
    }
  }
  
  function drawAnnotation(ann, isSelected) {
    ctx.save();
    ctx.translate(ann.cx, ann.cy);
    ctx.rotate(ann.rotation);
    ctx.lineWidth = 2;
    ctx.strokeStyle = isSelected ? 'red' : 'blue';
    ctx.strokeRect(-ann.width / 2, -ann.height / 2, ann.width, ann.height);
    ctx.restore();
    
    if (isSelected) {
      const handles = getAnnotationHandles(ann);
      // Draw corner handles as white squares (8x8 with 1px border)
      const size = 8;
      ctx.fillStyle = 'white';
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'black';
      ['tl', 'tr', 'bl', 'br'].forEach(key => {
        let h = handles[key];
        ctx.fillRect(h.x - size / 2, h.y - size / 2, size, size);
        ctx.strokeRect(h.x - size / 2, h.y - size / 2, size, size);
      });
      // Draw rotation handle as a red circle (radius 5, 1px border)
      const rHandle = handles.rotate;
      ctx.beginPath();
      ctx.arc(rHandle.x, rHandle.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = 'red';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'black';
      ctx.stroke();
      // Draw delete handle as a white square (12x12 with 1px border) with an "X"
      const dHandle = handles.delete;
      ctx.fillStyle = 'white';
      ctx.fillRect(dHandle.x - 6, dHandle.y - 6, 12, 12);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'black';
      ctx.strokeRect(dHandle.x - 6, dHandle.y - 6, 12, 12);
      ctx.fillStyle = 'black';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('X', dHandle.x, dHandle.y);
    }
  }
  
  function getAnnotationHandles(ann) {
    const hw = ann.width / 2, hh = ann.height / 2;
    const localHandles = {
      tl: { x: -hw, y: -hh },
      tr: { x: hw, y: -hh },
      bl: { x: -hw, y: hh },
      br: { x: hw, y: hh },
      rotate: { x: 0, y: -hh - 30 },
      delete: { x: hw + 10, y: -hh - 10 }
    };
    const handles = {};
    for (let key in localHandles) {
      const local = localHandles[key];
      const cos = Math.cos(ann.rotation), sin = Math.sin(ann.rotation);
      handles[key] = {
        x: ann.cx + local.x * cos - local.y * sin,
        y: ann.cy + local.x * sin + local.y * cos
      };
    }
    return handles;
  }
  
  function isPointInAnnotation(ann, x, y) {
    const dx = x - ann.cx, dy = y - ann.cy;
    const cos = Math.cos(-ann.rotation), sin = Math.sin(-ann.rotation);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;
    return (Math.abs(localX) <= ann.width / 2 && Math.abs(localY) <= ann.height / 2);
  }
  
  function isPointNearHandle(point, handle, radius = 8) {
    const dx = point.x - handle.x, dy = point.y - handle.y;
    return Math.sqrt(dx * dx + dy * dy) < radius;
  }
  
  /***********************
   * Converting Coordinates to Original Image Scale
   ***********************/
  function getAnnotationCornersOriginal(ann) {
    const hw = ann.width / 2, hh = ann.height / 2;
    function transform(local) {
      const xCanvas = ann.cx + local.x * Math.cos(ann.rotation) - local.y * Math.sin(ann.rotation);
      const yCanvas = ann.cy + local.x * Math.sin(ann.rotation) + local.y * Math.cos(ann.rotation);
      const scaleX = sourceImage.naturalWidth / canvas.width;
      const scaleY = sourceImage.naturalHeight / canvas.height;
      return [Math.round(xCanvas * scaleX), Math.round(yCanvas * scaleY)];
    }
    return [
      transform({ x: -hw, y: -hh }), // topLeft
      transform({ x: hw, y: -hh }),  // topRight
      transform({ x: hw, y: hh }),   // bottomRight
      transform({ x: -hw, y: hh })   // bottomLeft
    ];
  }
  
  /***********************
   * Build JSON of All Annotations (BoxCoordinates)
   ***********************/
  function getAllAnnotationsJSON() {
    const arr = annotations.map(ann => getAnnotationCornersOriginal(ann));
    return JSON.stringify(arr);
  }
  
  /***********************
   * Canvas Mouse Event Handlers
   ***********************/
  canvas.addEventListener('mousedown', function (e) {
    if (magnifierActive) return;
    const canvasRect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - canvasRect.left;
    const mouseY = e.clientY - canvasRect.top;
    startX = mouseX;
    startY = mouseY;
    
    // On first click for annotation, set tAnnotationStart and log t1.
    if (currentMode === 'none' && tAnnotationStart === 0) {
      tAnnotationStart = Date.now();
      let t1 = tAnnotationStart - tIdentifyStart;
      console.log("t1 (Identification Time):", t1, "ms");
    }
    
    if (selectedAnnotation) {
      const handles = getAnnotationHandles(selectedAnnotation);
      if (isPointNearHandle({ x: mouseX, y: mouseY }, handles.delete)) {
        annotations = annotations.filter(ann => ann !== selectedAnnotation);
        selectedAnnotation = null;
        drawCanvas();
        updateButtonState();
        return;
      }
      if (isPointNearHandle({ x: mouseX, y: mouseY }, handles.rotate)) {
        currentMode = 'rotate';
        originalMouseAngle = Math.atan2(mouseY - selectedAnnotation.cy, mouseX - selectedAnnotation.cx);
        originalAnnotationRotation = selectedAnnotation.rotation;
        return;
      }
      for (let key of ['tl', 'tr', 'bl', 'br']) {
        if (isPointNearHandle({ x: mouseX, y: mouseY }, handles[key])) {
          currentMode = 'resize';
          activeHandle = key;
          const opposite = { tl: 'br', tr: 'bl', bl: 'tr', br: 'tl' }[key];
          resizingFixedCorner = handles[opposite];
          return;
        }
      }
      if (isPointInAnnotation(selectedAnnotation, mouseX, mouseY)) {
        currentMode = 'move';
        offset.x = mouseX - selectedAnnotation.cx;
        offset.y = mouseY - selectedAnnotation.cy;
        return;
      }
    }
    
    let found = false;
    for (let i = annotations.length - 1; i >= 0; i--) {
      if (isPointInAnnotation(annotations[i], mouseX, mouseY)) {
        selectedAnnotation = annotations[i];
        currentMode = 'move';
        offset.x = mouseX - selectedAnnotation.cx;
        offset.y = mouseY - selectedAnnotation.cy;
        found = true;
        drawCanvas();
        break;
      }
    }
    if (found) return;
    
    currentMode = 'draw';
    currentDrawingAnnotation = {
      cx: (startX + mouseX) / 2,
      cy: (startY + mouseY) / 2,
      width: Math.abs(mouseX - startX),
      height: Math.abs(mouseY - startY),
      rotation: 0
    };
    selectedAnnotation = currentDrawingAnnotation;
    drawCanvas();
  });
  
  canvas.addEventListener('mousemove', function (e) {
    if (magnifierActive) return;
    const canvasRect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - canvasRect.left;
    const mouseY = e.clientY - canvasRect.top;
    
    if (currentMode === 'draw' && currentDrawingAnnotation) {
      currentDrawingAnnotation.cx = (startX + mouseX) / 2;
      currentDrawingAnnotation.cy = (startY + mouseY) / 2;
      currentDrawingAnnotation.width = Math.abs(mouseX - startX);
      currentDrawingAnnotation.height = Math.abs(mouseY - startY);
      drawCanvas();
    } else if (currentMode === 'move' && selectedAnnotation) {
      let newCX = mouseX - offset.x;
      let newCY = mouseY - offset.y;
      const cosTheta = Math.abs(Math.cos(selectedAnnotation.rotation));
      const sinTheta = Math.abs(Math.sin(selectedAnnotation.rotation));
      const boundingW = selectedAnnotation.width * cosTheta + selectedAnnotation.height * sinTheta;
      const boundingH = selectedAnnotation.width * sinTheta + selectedAnnotation.height * cosTheta;
      newCX = clamp(newCX, boundingW / 2, canvas.width - boundingW / 2);
      newCY = clamp(newCY, boundingH / 2, canvas.height - boundingH / 2);
      selectedAnnotation.cx = newCX;
      selectedAnnotation.cy = newCY;
      drawCanvas();
    } else if (currentMode === 'resize' && selectedAnnotation) {
      let newCX = (resizingFixedCorner.x + mouseX) / 2;
      let newCY = (resizingFixedCorner.y + mouseY) / 2;
      let dx = mouseX - newCX;
      let dy = mouseY - newCY;
      let cos = Math.cos(-selectedAnnotation.rotation);
      let sin = Math.sin(-selectedAnnotation.rotation);
      let localX = dx * cos - dy * sin;
      let localY = dx * sin + dy * cos;
      selectedAnnotation.cx = newCX;
      selectedAnnotation.cy = newCY;
      selectedAnnotation.width = Math.abs(localX) * 2;
      selectedAnnotation.height = Math.abs(localY) * 2;
      drawCanvas();
    } else if (currentMode === 'rotate' && selectedAnnotation) {
      let angle = Math.atan2(mouseY - selectedAnnotation.cy, mouseX - selectedAnnotation.cx);
      let deltaAngle = angle - originalMouseAngle;
      selectedAnnotation.rotation = originalAnnotationRotation + deltaAngle;
      drawCanvas();
    }
  });
  
  canvas.addEventListener('mouseup', function (e) {
    if (magnifierActive) return;
    if (currentMode === 'draw' && currentDrawingAnnotation) {
      annotations.push(currentDrawingAnnotation);
      currentDrawingAnnotation = null;
      startToDrawEnd = Date.now();
      if (tAnnotationStart === 0) {
        tAnnotationStart = Date.now();
      }
    }
    currentMode = 'none';
    activeHandle = null;
    resizingFixedCorner = null;
    drawCanvas();
    updateButtonState();
  });
  
  /***********************
   * Draggable & Resizable Magnifier
   ***********************/
  let magnifierActive = false;
  let lens; // the magnifier lens element
  let lensSize = 150;  // initial diameter in pixels (resizable)
  const zoomFactor = 2;  // magnification factor
  let draggingLens = false;
  let isResizingLens = false;
  let lensOffset = { x: 0, y: 0 };
  let initialLensSize = 150;
  let initialMousePos = { x: 0, y: 0 };
  const resizeMargin = 20; // margin in pixels to trigger resizing
  
  function updateLensCursor(e) {
    if (!lens) return;
    const lensRect = lens.getBoundingClientRect();
    const x = e.clientX - lensRect.left;
    const y = e.clientY - lensRect.top;
    if (x < resizeMargin || x > lensRect.width - resizeMargin ||
        y < resizeMargin || y > lensRect.height - resizeMargin) {
      lens.style.cursor = 'nwse-resize';
    } else {
      lens.style.cursor = 'move';
    }
  }
  
  magnifyToggle.addEventListener('click', function (e) {
    if (magnifierActive) {
      hideLens();
    } else {
      showLens();
    }
    e.stopPropagation();
  });
  
  function showLens() {
    if (!lens) {
      lens = document.createElement('div');
      lens.className = 'lens';
      const lensCanvas = document.createElement('canvas');
      lensCanvas.width = lensSize;
      lensCanvas.height = lensSize;
      lens.appendChild(lensCanvas);
      lens.ctx = lensCanvas.getContext('2d');
      const containerRect = container.getBoundingClientRect();
      lens.style.left = (containerRect.left + canvas.width / 2 - lensSize / 2) + 'px';
      lens.style.top = (containerRect.top + canvas.height / 2 - lensSize / 2) + 'px';
      document.body.appendChild(lens);
      
      lens.addEventListener('mousemove', updateLensCursor);
      
      lens.addEventListener('mousedown', function (e) {
        const lensRect = lens.getBoundingClientRect();
        const x = e.clientX - lensRect.left;
        const y = e.clientY - lensRect.top;
        if (x < resizeMargin || x > lensRect.width - resizeMargin ||
            y < resizeMargin || y > lensRect.height - resizeMargin) {
          isResizingLens = true;
          initialLensSize = lensSize;
          initialMousePos = { x: e.clientX, y: e.clientY };
        } else {
          draggingLens = true;
          lensOffset.x = e.clientX - lensRect.left;
          lensOffset.y = e.clientY - lensRect.top;
        }
        e.stopPropagation();
        e.preventDefault();
      });
      
      document.addEventListener('mousemove', function (e) {
        if (isResizingLens) {
          const dx = e.clientX - initialMousePos.x;
          const dy = e.clientY - initialMousePos.y;
          const delta = (Math.abs(dx) + Math.abs(dy)) / 2;
          const sign = (dx + dy) >= 0 ? 1 : -1;
          let newSize = initialLensSize + sign * delta;
          newSize = Math.max(50, Math.min(newSize, canvas.width));
          lensSize = newSize;
          lens.style.width = lensSize + 'px';
          lens.style.height = lensSize + 'px';
          const lensCanvas = lens.querySelector('canvas');
          lensCanvas.width = lensSize;
          lensCanvas.height = lensSize;
          updateLens();
        } else if (draggingLens) {
          let newLeft = e.clientX - lensOffset.x;
          let newTop = e.clientY - lensOffset.y;
          const containerRect = container.getBoundingClientRect();
          newLeft = clamp(newLeft, containerRect.left, containerRect.left + canvas.width - lensSize);
          newTop = clamp(newTop, containerRect.top, containerRect.top + canvas.height - lensSize);
          lens.style.left = newLeft + 'px';
          lens.style.top = newTop + 'px';
          updateLens();
        }
      });
      
      document.addEventListener('mouseup', function (e) {
        draggingLens = false;
        isResizingLens = false;
      });
    }
    lens.style.display = 'block';
    magnifierActive = true;
    drawCanvas();
    updateLens();
  }
  
  function hideLens() {
    if (lens) {
      lens.style.display = 'none';
    }
    magnifierActive = false;
  }
  
  function updateLens() {
    if (!lens) return;
    const lensRect = lens.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const lensCenterX = lensRect.left - containerRect.left + lensSize / 2;
    const lensCenterY = lensRect.top - containerRect.top + lensSize / 2;
    const regionWidth = lensSize / zoomFactor;
    const regionHeight = lensSize / zoomFactor;
    let sx = lensCenterX - regionWidth / 2;
    let sy = lensCenterY - regionHeight / 2;
    sx = Math.max(0, Math.min(sx, canvas.width - regionWidth));
    sy = Math.max(0, Math.min(sy, canvas.height - regionHeight));
    const lensCanvas = lens.querySelector('canvas');
    const lensCtx = lensCanvas.getContext('2d');
    lensCtx.clearRect(0, 0, lensSize, lensSize);
    lensCtx.drawImage(canvas, sx, sy, regionWidth, regionHeight, 0, 0, lensSize, lensSize);
  }
  
  /***********************
   * Button Logic & Sending Annotations
   ***********************/
  function updateButtonState() {
    if (nextButton.textContent.trim() === "Next Image") {
      nextButton.disabled = false;
    } else {
      nextButton.disabled = annotations.length > 0 ? false : true;
    }
  }
  
  function getAllAnnotationsJSON() {
    const arr = annotations.map(ann => getAnnotationCornersOriginal(ann));
    return JSON.stringify(arr);
  }
  
  function getAnnotationCornersOriginal(ann) {
    const hw = ann.width / 2, hh = ann.height / 2;
    function transform(local) {
      const xCanvas = ann.cx + local.x * Math.cos(ann.rotation) - local.y * Math.sin(ann.rotation);
      const yCanvas = ann.cy + local.x * Math.sin(ann.rotation) + local.y * Math.cos(ann.rotation);
      const scaleX = sourceImage.naturalWidth / canvas.width;
      const scaleY = sourceImage.naturalHeight / canvas.height;
      return [Math.round(xCanvas * scaleX), Math.round(yCanvas * scaleY)];
    }
    return [
      transform({ x: -hw, y: -hh }), // topLeft
      transform({ x: hw, y: -hh }),  // topRight
      transform({ x: hw, y: hh }),   // bottomRight
      transform({ x: -hw, y: hh })   // bottomLeft
    ];
  }
  
  endButton.addEventListener('click', function () {
    const requestData = {
      isAnnotationStarted: annotations.length > 0,
      medDataId: window.annotatedMedData ? window.annotatedMedData.id : null
    };
  
    fetch(`/Identity/Logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    })
      .then(response => response.json())
      .then(result => {
        if (result.success) {
          window.location.href = '/Identity/Login';
        } else {
          console.error("Failed to process data.");
        }
      })
      .catch(error => console.error('Error:', error));
  });
  
  // Helper: store current annotation data.
  // For "Save and Next Term", compute timestamps and boxCoordinates.
  // For other actions ("Uncertain/Skip" or "Not Visible/Abstract"), store them empty.
  function storeCurrentAnnotation(pressedButton) {
    const currentKeyword = document.querySelector('.current_keyword');
    if (currentKeyword) {
      let medData = window.annotatedMedData;
      let boxCoordinates = "";
      let timestamps = "";
      // Read comment value from the textbox.
      const commentField = document.getElementById("comments");
      const commentValue = commentField.value.trim();
  
      if (pressedButton === "Save and Next Term") {
        boxCoordinates = getAllAnnotationsJSON();
        let t2 = Date.now() - tAnnotationStart;
        let t1 = tAnnotationStart - tIdentifyStart;
        timestamps = `(${t1},${t2})`;
      }
      // Store the annotation data along with the comment.
      allKeywordAnnotations.push({
        Id: medData.id,
        ImageUrl: medData.imageUrl,              // adjust casing if needed
        ImageDescription: medData.imageDescription,
        Sex: medData.sex,
        Age: medData.age,
        SkinTone: medData.skinTone,
        BodyRegion: medData.bodyRegion,
        Diagnosis: medData.diagnosis,
        TreatmentName: medData.treatmentName,
        Speciality: medData.speciality,
        Modality: medData.modality,
        BoxCoordinates: boxCoordinates,
        ExtractedKeyword: currentKeyword.textContent,
        Timestamps: timestamps,
        PressedButton: pressedButton,
        Comment: commentValue  // new property for the comment
      });
  
      // Clear the textbox after storing.
      commentField.value = "";
  
      let currentIndex = Number(currentKeyword.id.split('-')[1]);
      if (pressedButton === "Save and Next Term") {
        currentKeyword.classList.remove('current_keyword');
        currentKeyword.classList.add('annotated_keyword');
        keywordStates[currentIndex] = 2;
      } else {
        currentKeyword.classList.remove('current_keyword');
        currentKeyword.classList.add('skipped_keyword');
        keywordStates[currentIndex] = 4;
      }
  
      const nextKeyword = currentKeyword.nextElementSibling;
      if (nextKeyword && nextKeyword.classList.contains('not_annotated_keyword')) {
        nextKeyword.classList.remove('not_annotated_keyword');
        nextKeyword.classList.add('current_keyword');
        keywordStates[currentIndex + 1] = 3;
        tIdentifyStart = Date.now();
        tAnnotationStart = 0;
      } else {
        nextButton.textContent = "Next Image";
        skipButton.disabled = true;
        notPresentButton.disabled = true;
      }
    }
  }
  
  nextButton.addEventListener('click', function () {
    if (nextButton.textContent.trim() === "Save and Next Term") {
      if (annotations.length > 0) {
        storeCurrentAnnotation("Save and Next Term");
        resetAnnotation();
      }
    } else {
      // Next Image branch: send all accumulated keyword annotations.
      const payload = { 
        MedDataId: window.annotatedMedData.id, 
        Items: allKeywordAnnotations 
      };
      console.log(payload);
      
      fetch(`/MedData/NextImage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(response => response.json())
        .then(result => {
          if (result.success) {
            allKeywordAnnotations = [];
            resetAnnotation();
            location.reload();
          } else {
            console.error("Failed to process data.");
          }
        })
        .catch(error => console.error('Error:', error));
    }
  });
  
  function skipOrNotPresentHandler(event) {
    storeCurrentAnnotation(event.target.id === 'skip-button' ? "Uncertain/Skip" : "Not Visible/Abstract");
    resetAnnotation();
    tIdentifyStart = Date.now();
  }
  
  skipButton.addEventListener('click', skipOrNotPresentHandler);
  notPresentButton.addEventListener('click', skipOrNotPresentHandler);
  
  function resetAnnotation() {
    annotations = [];
    selectedAnnotation = null;
    currentMode = 'none';
    drawCanvas();
    updateButtonState();
    isFirstDraw = true;
    tAnnotationStart = 0;
  }
  
  function updateButtonState() {
    if (nextButton.textContent.trim() === "Next Image") {
      nextButton.disabled = false;
    } else {
      nextButton.disabled = annotations.length > 0 ? false : true;
    }
  }
  
  // Update keyword UI and button states.
  function updateKeywordUI() {
    for (let i = 0; i < keywords.length; i++) {
      let curr = keywords[i];
      curr.classList.remove('current_keyword', 'annotated_keyword', 'not_annotated_keyword', 'skipped_keyword');
      if (keywordStates[i] === 1) {
        curr.classList.add('not_annotated_keyword');
      } else if (keywordStates[i] === 2) {
        curr.classList.add('annotated_keyword');
      } else if (keywordStates[i] === 3) {
        curr.classList.add('current_keyword');
      } else if (keywordStates[i] === 4) {
        curr.classList.add('skipped_keyword');
      }
    }
  }
  updateKeywordUI();
  updateKeywordButtonStates();
});
