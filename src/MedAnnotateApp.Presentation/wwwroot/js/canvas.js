// Canvas Manager Class
class CanvasManager {
    constructor(canvasId, sourceImageId, containerId) {
      this.canvas = document.getElementById(canvasId);
      this.ctx = this.canvas.getContext("2d");
      this.sourceImage = document.getElementById(sourceImageId);
      this.container = document.getElementById(containerId);
      
      // Annotation state
      this.annotations = [];
      this.selectedAnnotation = null;
      this.currentAction = "none";
      this.currentMode = "rectangle";
      this.offset = { x: 0, y: 0 };
      this.activeHandle = null;
      this.resizingFixedCorner = null;
      this.originalMouseAngle = 0;
      this.originalAnnotationRotation = 0;
      this.rectStart = null;
      this.freehandPoints = [];
      this.currentDrawingAnnotation = null;
      this.isFirstDraw = true;
      
      // Callback for annotation changes
      this.onAnnotationsChange = null;
  
      // Magnifier state
      this.usingLens = false;
      this.lens = null;
      this._lensSize = 150;
      this._zoomFactor = 4;
      this.draggingLens = false;
      this.isResizingLens = false;
      this.lensOffset = { x: 0, y: 0 };
      this.initialLensSize = 150;
      this.initialMousePos = { x: 0, y: 0 };
      this.resizeMargin = 20;
  
      // Setup event listeners
      this.setupEventListeners();
      this.setupImageLoad();
    }
  
    // RDP Algorithm for freehand simplification
    rdp(points, epsilon) {
      if (points.length < 3) return points;
      
      let dmax = 0;
      let index = 0;
      const start = points[0];
      const end = points[points.length - 1];
      
      for (let i = 1; i < points.length - 1; i++) {
        const d = this.perpendicularDistance(points[i], start, end);
        if (d > dmax) {
          index = i;
          dmax = d;
        }
      }
      
      if (dmax > epsilon) {
        const recResults1 = this.rdp(points.slice(0, index + 1), epsilon);
        const recResults2 = this.rdp(points.slice(index), epsilon);
        return recResults1.slice(0, -1).concat(recResults2);
      } else {
        return [start, end];
      }
    }
  
    perpendicularDistance(p, p1, p2) {
      const num = Math.abs(
        (p2.y - p1.y) * p.x - (p2.x - p1.x) * p.y + p2.x * p1.y - p2.y * p1.x
      );
      const den = Math.hypot(p2.y - p1.y, p2.x - p1.x);
      return num / den;
    }
  
    normalizeToTenPoints(points) {
      if (points.length <= 10) return points;
      
      const result = [points[0]];
      const step = (points.length - 1) / 9;
      
      for (let i = 1; i < 9; i++) {
        const index = Math.round(i * step);
        result.push(points[index]);
      }
      
      result.push(points[points.length - 1]);
      return result;
    }
  
    boundaryCheck(annotation) {
      if (annotation.type === "rectangle") {
        // Get rectangle corners in screen space
        const hw = annotation.width / 2;
        const hh = annotation.height / 2;
        const cos = Math.cos(annotation.rotation);
        const sin = Math.sin(annotation.rotation);
        
        // Calculate all four corners in screen space
        const corners = [
          { x: annotation.cx + (-hw * cos - hh * sin), y: annotation.cy + (-hw * sin + hh * cos) }, // top-left
          { x: annotation.cx + (hw * cos - hh * sin), y: annotation.cy + (hw * sin + hh * cos) },   // top-right
          { x: annotation.cx + (hw * cos + hh * sin), y: annotation.cy + (hw * sin - hh * cos) },   // bottom-right
          { x: annotation.cx + (-hw * cos + hh * sin), y: annotation.cy + (-hw * sin - hh * cos) }  // bottom-left
        ];
        
        // Find the bounding box of the rotated rectangle
        let minX = Math.min(...corners.map(c => c.x));
        let minY = Math.min(...corners.map(c => c.y));
        let maxX = Math.max(...corners.map(c => c.x));
        let maxY = Math.max(...corners.map(c => c.y));
        
        // Calculate boundary margins
        const margin = 2;
        
        // Calculate how much to move the rectangle to stay within bounds
        let moveX = 0;
        let moveY = 0;
        
        if (minX < margin) {
          moveX = margin - minX;
        } else if (maxX > this.canvas.width - margin) {
          moveX = this.canvas.width - margin - maxX;
        }
        
        if (minY < margin) {
          moveY = margin - minY;
        } else if (maxY > this.canvas.height - margin) {
          moveY = this.canvas.height - margin - maxY;
        }
        
        // Apply the movement to the center point
        annotation.cx += moveX;
        annotation.cy += moveY;
        
        return annotation;
      } else if (annotation.type === "freehand") {
        // Keep freehand points within canvas bounds
        const margin = 2;
        annotation.points = annotation.points.map(point => ({
          x: this.clamp(point.x, margin, this.canvas.width - margin),
          y: this.clamp(point.y, margin, this.canvas.height - margin)
        }));
        
        return annotation;
      }
      return annotation;
    }
  
    // Tool creation and management
    createTools(imageContainer) {
      const toolsContainer = document.createElement("div");
      toolsContainer.className = "tools-container";
      toolsContainer.style.position = "fixed";
      
      // Create rectangle button
      const rectButton = this.createToolButton("rectangle", "../images/rectangle-icon.png", "Rectangle Mode", true);
      
      // Create freehand button
      const freehandButton = this.createToolButton("freehand", "../images/pen-icon.png", "Freehand Mode", false);
      
      // Create magnify button
      const magnifyButton = this.createToolButton("magnify", "../images/magnifying-glass.png", "Magnifier Tool", false);
      
      toolsContainer.appendChild(rectButton);
      toolsContainer.appendChild(freehandButton);
      toolsContainer.appendChild(magnifyButton);
      
      document.body.appendChild(toolsContainer);
      this.toolsContainer = toolsContainer;
  
      // Store buttons for later use
      this.rectButton = rectButton;
      this.freehandButton = freehandButton;
      this.magnifyButton = magnifyButton;
  
      this.updateToolsPosition(imageContainer);
      return { rectButton, freehandButton, magnifyButton };
    }
  
    createToolButton(type, iconSrc, title, isActive) {
      const button = document.createElement("div");
      button.className = `tool-button${isActive ? " active" : ""}`;
      button.id = `${type}ModeButton`;
      button.title = title;
      
      const icon = document.createElement("img");
      icon.src = iconSrc;
      icon.alt = title;
      
      button.appendChild(icon);
      return button;
    }
  
    updateToolsPosition(imageContainer) {
      if (!this.toolsContainer) return;
      
      // Get positions and dimensions
      const canvasRect = this.canvas.getBoundingClientRect();
      const imageContainerRect = imageContainer.getBoundingClientRect();
      
      // Position the tools container with a larger margin of 15px
      // and vertically centered with the canvas
      this.toolsContainer.style.position = "fixed";
      this.toolsContainer.style.left = (canvasRect.right + 5) + "px";
      this.toolsContainer.style.top = (canvasRect.top + (canvasRect.height / 2) - (this.toolsContainer.offsetHeight / 2)) + "px";
    }
  
    // Mode switching
    switchMode(newMode) {
      // Store previous mode for restoration
      const previousMode = this.currentMode;
      
      // Special handling for magnifier mode
      if (newMode === "magnifier") {
        // Toggle magnifier on/off
        if (this.usingLens) {
          this.hideLens();
          // Reset magnifier button style
          if (this.magnifyButton) {
            this.magnifyButton.classList.remove("active");
            this.magnifyButton.style.backgroundColor = "white";
            this.magnifyButton.style.borderColor = "#dee2e6";
          }
        } else {
          this.showLens();
          // Set magnifier button style
          if (this.magnifyButton) {
            this.magnifyButton.classList.add("active");
            this.magnifyButton.style.backgroundColor = "#d9534f"; // Lighter red color
            this.magnifyButton.style.borderColor = "#d9534f";
          }
        }
        return; // Don't change the current drawing mode
      }
      
      // Do nothing if trying to switch to the same drawing mode
      if (this.currentMode === newMode && newMode !== "magnifier") return;

      // Update the current mode for rectangle/freehand
      this.currentMode = newMode;
      
      // Hide lens when switching to annotation modes
      if (this.usingLens) {
        this.hideLens();
        if (this.magnifyButton) {
          this.magnifyButton.classList.remove("active");
          this.magnifyButton.style.backgroundColor = "white";
          this.magnifyButton.style.borderColor = "#dee2e6";
        }
      }
      
      // Update button states for rectangle/freehand
      if (this.rectButton && this.freehandButton) {
        // Reset annotation button states
        this.rectButton.classList.remove("active");
        this.freehandButton.classList.remove("active");
        
        // Reset annotation button styles
        this.rectButton.style.backgroundColor = "white";
        this.rectButton.style.borderColor = "#dee2e6";
        this.freehandButton.style.backgroundColor = "white";
        this.freehandButton.style.borderColor = "#dee2e6";
        
        // Apply active state to the correct annotation button
        if (newMode === "rectangle") {
          this.rectButton.classList.add("active");
          this.rectButton.style.backgroundColor = "#d9534f"; // Lighter red color
          this.rectButton.style.borderColor = "#d9534f";
        } else if (newMode === "freehand") {
          this.freehandButton.classList.add("active");
          this.freehandButton.style.backgroundColor = "#d9534f"; // Lighter red color
          this.freehandButton.style.borderColor = "#d9534f";
        }
      }
    }
  
    // Canvas drawing and manipulation
    drawCanvas() {
      // Clear the canvas
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      // Draw the image
      this.ctx.drawImage(this.sourceImage, 0, 0, this.canvas.width, this.canvas.height);
      
      // Draw all annotations
      this.annotations.forEach(ann => this.drawAnnotation(ann, ann === this.selectedAnnotation));
      if (this.currentAction === "draw" && this.currentDrawingAnnotation) {
        this.drawAnnotation(this.currentDrawingAnnotation, true);
      }
    }
  
    drawAnnotation(ann, isSelected) {
      if (ann.type === "rectangle") {
        this.drawRectangle(ann, isSelected);
      } else if (ann.type === "freehand") {
        this.drawFreehand(ann, isSelected);
      }
      
      if (isSelected) {
        this.drawHandles(ann);
      }
    }
  
    drawRectangle(ann, isSelected) {
      this.ctx.save();
      this.ctx.translate(ann.cx, ann.cy);
      this.ctx.rotate(ann.rotation);
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = isSelected ? "red" : "blue";
      this.ctx.strokeRect(-ann.width / 2, -ann.height / 2, ann.width, ann.height);
      
      // Add fill with transparency and border
      this.ctx.fillStyle = isSelected ? "rgba(255,0,0,0.1)" : "rgba(0,0,255,0.1)";
      this.ctx.fillRect(-ann.width / 2, -ann.height / 2, ann.width, ann.height);
      
      // Add second border for better visibility
      this.ctx.strokeStyle = 'white';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(-ann.width / 2 - 1, -ann.height / 2 - 1, ann.width + 2, ann.height + 2);
      
      this.ctx.restore();
    }
  
    drawFreehand(ann, isSelected) {
      this.ctx.beginPath();
      ann.points.forEach((pt, index) => {
        if (index === 0) this.ctx.moveTo(pt.x, pt.y);
        else this.ctx.lineTo(pt.x, pt.y);
      });
      
      // Close the path if it's not closed
      if (ann.points.length > 2) {
        const first = ann.points[0];
        const last = ann.points[ann.points.length - 1];
        if (Math.hypot(last.x - first.x, last.y - first.y) > 5) {
          this.ctx.lineTo(first.x, first.y);
        }
      }
      
      // Add white border first
      this.ctx.strokeStyle = 'white';
      this.ctx.lineWidth = 3;
      this.ctx.stroke();
      
      // Then add colored border
      this.ctx.strokeStyle = isSelected ? "red" : "blue";
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      
      // Add fill with transparency
      this.ctx.fillStyle = isSelected ? "rgba(255,0,0,0.1)" : "rgba(0,0,255,0.1)";
      this.ctx.fill();
    }
  
    drawHandles(ann) {
      if (ann.type === "rectangle") {
        const handles = this.getAnnotationHandles(ann);
        this.drawRectangleHandles(handles);
      } else if (ann.type === "freehand") {
        this.drawFreehandHandles(ann);
      }
    }
  
    drawRectangleHandles(handles) {
      const size = 8;
      this.ctx.fillStyle = "white";
      this.ctx.lineWidth = 1;
      this.ctx.strokeStyle = "black";
      
      // Draw resize handles
      ['tl', 'tr', 'bl', 'br'].forEach(key => {
        let h = handles[key];
        this.ctx.fillRect(h.x - size/2, h.y - size/2, size, size);
        this.ctx.strokeRect(h.x - size/2, h.y - size/2, size, size);
      });
      
      // Draw rotation handle
      const rHandle = handles.rotate;
      this.ctx.beginPath();
      this.ctx.arc(rHandle.x, rHandle.y, 5, 0, 2 * Math.PI);
      this.ctx.fillStyle = "red";
      this.ctx.fill();
      this.ctx.lineWidth = 1;
      this.ctx.strokeStyle = "black";
      this.ctx.stroke();
      
      // Draw delete handle with X
      const dHandle = handles.delete;
      this.ctx.fillStyle = "white";
      this.ctx.fillRect(dHandle.x - 6, dHandle.y - 6, 12, 12);
      this.ctx.lineWidth = 1;
      this.ctx.strokeStyle = "black";
      this.ctx.strokeRect(dHandle.x - 6, dHandle.y - 6, 12, 12);
      this.ctx.fillStyle = "black";
      this.ctx.font = "10px sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText("X", dHandle.x, dHandle.y);
    }
  
    drawFreehandHandles(ann) {
      // For freehand shapes, compute the bounding box and draw a delete handle
      const bbox = this.getBoundingBox(ann.points);
      const handleX = bbox.maxX + 5;
      const handleY = bbox.minY - 5;
      
      // Draw delete handle with X
      this.ctx.fillStyle = "white";
      this.ctx.fillRect(handleX, handleY, 12, 12);
      this.ctx.lineWidth = 1;
      this.ctx.strokeStyle = "black";
      this.ctx.strokeRect(handleX, handleY, 12, 12);
      this.ctx.fillStyle = "black";
      this.ctx.font = "10px sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText("X", handleX + 6, handleY + 6);
    }
  
    // Magnifier functions
    showLens() {
      if (this.lens) {
        document.body.removeChild(this.lens);
        this.lens = null;
      }
      
      // Clear displayed annotations regardless of page type
      this.clearDisplayedAnnotations();
      
      this.lens = document.createElement("div");
      this.lens.className = "lens";
      
      // Make lens circular with red border - using lighter red color
      this.lens.style.border = "2px solid #d9534f";
      this.lens.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
      this.lens.style.borderRadius = "50%";
      this.lens.style.overflow = "hidden";
      this.lens.style.position = "fixed";
      this.lens.style.width = "180px";
      this.lens.style.height = "180px";
      this.lens.style.pointerEvents = "auto";
      this.lens.style.zIndex = "1000";
      
      const lensCanvas = document.createElement("canvas");
      lensCanvas.width = this._lensSize;
      lensCanvas.height = this._lensSize;
      this.lens.appendChild(lensCanvas);
      this.lens.ctx = lensCanvas.getContext("2d");
      
      const canvasRect = this.canvas.getBoundingClientRect();
      const lensLeft = canvasRect.left + (canvasRect.width / 2) - (this._lensSize / 2);
      const lensTop = canvasRect.top + (canvasRect.height / 2) - (this._lensSize / 2);
      
      this.lens.style.width = this._lensSize + "px";
      this.lens.style.height = this._lensSize + "px";
      this.lens.style.left = lensLeft + "px";
      this.lens.style.top = lensTop + "px";
      
      document.body.appendChild(this.lens);
      this.setupLensEventListeners();
      this.usingLens = true;
      this.updateLens();
      
      // Initially start showing the lens at the center of the canvas
      const centerX = canvasRect.left + canvasRect.width/2;
      const centerY = canvasRect.top + canvasRect.height/2;
      
      this.moveLensTo(centerX, centerY);
      
      // IMPORTANT: We specifically don't add any mouse follow behavior
      // The lens should only move when explicitly dragged
    }
  
    hideLens() {
      // Remove the lens element from the DOM
      if (this.lens) {
        // Remove any move and up handlers that might be attached to document
        if (this.lens.moveHandler) {
        document.removeEventListener("mousemove", this.lens.moveHandler);
        }
        
        if (this.lens.upHandler) {
        document.removeEventListener("mouseup", this.lens.upHandler);
        }
        
        document.body.removeChild(this.lens);
        this.lens = null;
      }
  
      // Remove specific event listeners for lens functionality
      if (this.canvas) {
        // Use bind to ensure correct this context
        this.canvas.removeEventListener('mousemove', this.handleLensFollowMouse.bind(this));
      }
      
      // Reset flags
      this.usingLens = false;
      this.draggingLens = false;
      this.isResizingLens = false;
      
      // Redraw the canvas with annotations
      this.drawCanvas();
    }
  
    updateLens() {
      if (!this.lens) return;
      
      const lensRect = this.lens.getBoundingClientRect();
      const canvasRect = this.canvas.getBoundingClientRect();
      
      const relativeLensX = (lensRect.left + lensRect.width/2) - canvasRect.left;
      const relativeLensY = (lensRect.top + lensRect.height/2) - canvasRect.top;
      
      const buffer = this._lensSize;
      if (relativeLensX < -buffer || relativeLensX > canvasRect.width + buffer ||
          relativeLensY < -buffer || relativeLensY > canvasRect.height + buffer) {
        return;
      }
      
      const scale = 1 / this._zoomFactor;
      const sourceWidth = this._lensSize * scale;
      const sourceHeight = this._lensSize * scale;
      
      let sourceX = relativeLensX - sourceWidth/2;
      let sourceY = relativeLensY - sourceHeight/2;
      
      sourceX = Math.max(0, Math.min(sourceX, this.canvas.width - sourceWidth));
      sourceY = Math.max(0, Math.min(sourceY, this.canvas.height - sourceHeight));
      
      const lensCanvas = this.lens.querySelector("canvas");
      const lensCtx = lensCanvas.getContext("2d");
      
      lensCtx.clearRect(0, 0, this._lensSize, this._lensSize);
      
      try {
        lensCtx.drawImage(
          this.canvas,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          this._lensSize,
          this._lensSize
        );
        
        const center = this._lensSize / 2;
        lensCtx.strokeStyle = "rgba(255,0,0,0.7)";
        lensCtx.lineWidth = 1;
        
        lensCtx.beginPath();
        lensCtx.moveTo(center - 10, center);
        lensCtx.lineTo(center + 10, center);
        lensCtx.stroke();
        
        lensCtx.beginPath();
        lensCtx.moveTo(center, center - 10);
        lensCtx.lineTo(center, center + 10);
        lensCtx.stroke();
      } catch (e) {
        console.error("Error updating lens:", e);
      }
    }
  
    // Modified to prevent automatic cursor following
    handleLensFollowMouse(e) {
      // We're intentionally leaving this empty to prevent 
      // the lens from automatically following the cursor
      return;
    }
  
    moveLensTo(x, y) {
      if (!this.lens) return;
      
      const lensRect = this.lens.getBoundingClientRect();
      const canvasRect = this.canvas.getBoundingClientRect();
      
      // Calculate new position keeping lens within canvas bounds
      const newX = Math.max(
        canvasRect.left,
        Math.min(x - lensRect.width/2, canvasRect.right - lensRect.width)
      );
      
      const newY = Math.max(
        canvasRect.top,
        Math.min(y - lensRect.height/2, canvasRect.bottom - lensRect.height)
      );
      
      this.lens.style.left = newX + "px";
      this.lens.style.top = newY + "px";
      
      this.updateLens();
    }
  
    // Helper functions
    getAnnotationHandles(ann) {
      const hw = ann.width / 2, hh = ann.height / 2;
      const localHandles = {
        tl: { x: -hw, y: -hh },
        tr: { x: hw, y: -hh },
        bl: { x: -hw, y: hh },
        br: { x: hw, y: hh },
        rotate: { x: 0, y: -hh - 30 },
        delete: { x: hw + 10, y: -hh - 10 },
      };
      
      const handles = {};
      for (let key in localHandles) {
        const local = localHandles[key];
        const cos = Math.cos(ann.rotation),
              sin = Math.sin(ann.rotation);
        handles[key] = {
          x: ann.cx + local.x * cos - local.y * sin,
          y: ann.cy + local.x * sin + local.y * cos,
        };
      }
      return handles;
    }
  
    getBoundingBox(points) {
      let minX = Infinity, minY = Infinity,
          maxX = -Infinity, maxY = -Infinity;
      
      points.forEach(pt => {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
      });
      
      return { minX, minY, maxX, maxY };
    }
  
    isPointInAnnotation(ann, x, y) {
      if (ann.type === "rectangle") {
        const dx = x - ann.cx, dy = y - ann.cy;
        const cos = Math.cos(-ann.rotation),
              sin = Math.sin(-ann.rotation);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;
        return Math.abs(localX) <= ann.width / 2 && Math.abs(localY) <= ann.height / 2;
      } else if (ann.type === "freehand") {
        for (let i = 0; i < ann.points.length - 1; i++) {
          if (this.distanceToSegment({ x, y }, ann.points[i], ann.points[i + 1]) < 5) {
            return true;
          }
        }
        return false;
      }
    }
  
    distanceToSegment(p, v, w) {
      const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
      if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
      let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
      t = Math.max(0, Math.min(1, t));
      const proj = {
        x: v.x + t * (w.x - v.x),
        y: v.y + t * (w.y - v.y)
      };
      return Math.hypot(p.x - proj.x, p.y - proj.y);
    }
  
    isPointNearHandle(point, handle, radius = 8) {
      const dx = point.x - handle.x,
            dy = point.y - handle.y;
      return Math.hypot(dx, dy) < radius;
    }
  
    // State management
    resetDrawingState() {
      this.currentDrawingAnnotation = null;
      this.rectStart = null;
      this.freehandPoints = [];
      this.currentAction = "none";
    }
  
    resetAnnotation() {
      this.annotations = [];
      this.selectedAnnotation = null;
      this.currentAction = "none";
      this.rectStart = null;
      this.freehandPoints = [];
      this.currentDrawingAnnotation = null;
      this.drawCanvas();
      this.isFirstDraw = true;
    }
  
    // Event handlers setup
    setupEventListeners() {
      this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
      this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
      this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
    }
  
    setupImageLoad() {
      this.sourceImage.onload = () => {
        const imgRatio = this.sourceImage.naturalWidth / this.sourceImage.naturalHeight;
        const imageContainer = document.getElementById("image-container");
        const canvasContainer = document.getElementById("canvasContainer");
        
        // Fixed height for professional page
        const fixedHeight = 430;
        
        // Calculate width based on image aspect ratio
        const calculatedWidth = Math.round(fixedHeight * imgRatio);
        
        // Set canvas dimensions to match the calculated size
        this.canvas.width = calculatedWidth;
        this.canvas.height = fixedHeight;
        
        // Now initialize canvas styles to ensure proper sizing
        if (imageContainer && canvasContainer) {
          // Size the containers to the exact dimensions
          imageContainer.style.width = calculatedWidth + 'px';
          imageContainer.style.height = fixedHeight + 'px';
          
          // Make sure the width doesn't cause overlap with the right column
          const containerWidth = calculatedWidth;
          const windowWidth = window.innerWidth;
          
          // If on student page (which has a different layout), ensure the image fits
          if (window.isStudentPage && containerWidth > (windowWidth - 450)) {
            // Scale down proportionally if needed
            const maxAllowedWidth = windowWidth - 450;
            if (maxAllowedWidth > 200) {
              const scale = maxAllowedWidth / containerWidth;
              const newWidth = Math.floor(containerWidth * scale);
              const newHeight = Math.floor(fixedHeight * scale);
              
              // Update container dimensions
              imageContainer.style.width = newWidth + 'px';
              imageContainer.style.height = newHeight + 'px';
              
              // Update canvas container as well
              canvasContainer.style.width = newWidth + 'px';
              canvasContainer.style.height = newHeight + 'px';
              
              // Update canvas dimensions to match the scaled size
              this.canvas.width = newWidth;
              this.canvas.height = newHeight;
              this.canvas.style.width = newWidth + 'px';
              this.canvas.style.height = newHeight + 'px';
            }
          } else {
            // Normal sizing when there's enough room
            canvasContainer.style.width = calculatedWidth + 'px';
            canvasContainer.style.height = fixedHeight + 'px';
            
            // Set exact canvas dimensions
            this.canvas.width = calculatedWidth;
            this.canvas.height = fixedHeight;
            this.canvas.style.width = calculatedWidth + 'px';
            this.canvas.style.height = fixedHeight + 'px';
          }
          
          // Draw the image on the canvas
        this.drawCanvas();
          
          // Update tools position now that canvas is sized
          this.updateToolsPosition(imageContainer);
        }
      };
      
      // Trigger the onload handler if image is already loaded
      if (this.sourceImage.complete) {
        this.sourceImage.onload();
      }
      
      // Re-initialize on window resize
      window.addEventListener('resize', () => {
        if (this.sourceImage.complete) {
          this.sourceImage.onload();
        }
        this.updateToolsPosition(document.getElementById("image-container"));
      });
      
      // Also update on scroll
      document.addEventListener('scroll', () => {
        this.updateToolsPosition(document.getElementById("image-container"));
      });
    }
  
    // Mouse event handlers
    handleMouseDown(e) {
      // Don't allow drawing when magnifier is active
      if (this.usingLens) return;
      
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Check for freehand delete button first
      if (this.selectedAnnotation && this.selectedAnnotation.type === "freehand") {
        const bbox = this.getBoundingBox(this.selectedAnnotation.points);
        const handleX = bbox.maxX + 5;
        const handleY = bbox.minY - 5;
        
        if (mouseX >= handleX && mouseX <= handleX + 12 &&
            mouseY >= handleY && mouseY <= handleY + 12) {
          this.annotations = this.annotations.filter(a => a !== this.selectedAnnotation);
          this.selectedAnnotation = null;
          this.drawCanvas();
          
          // Notify about annotation change
          if (this.onAnnotationsChange) {
            this.onAnnotationsChange();
          }
          return;
        }
      }
      
      // Check if we clicked on the selected annotation's handle
      if (this.selectedAnnotation && this.selectedAnnotation.type === "rectangle") {
        const handles = this.getAnnotationHandles(this.selectedAnnotation);
        
        // Check rotation handle
        if (this.isPointNearHandle({ x: mouseX, y: mouseY }, handles.rotate)) {
          this.currentAction = "rotate";
          this.originalMouseAngle = Math.atan2(mouseY - this.selectedAnnotation.cy, mouseX - this.selectedAnnotation.cx);
          this.originalAnnotationRotation = this.selectedAnnotation.rotation;
          return;
        }
        
        // Check delete handle
        if (this.isPointNearHandle({ x: mouseX, y: mouseY }, handles.delete)) {
          this.annotations = this.annotations.filter(a => a !== this.selectedAnnotation);
          this.selectedAnnotation = null;
          this.drawCanvas();
          
          // Notify about annotation change
          if (this.onAnnotationsChange) {
            this.onAnnotationsChange();
          }
          return;
        }
        
        // Check resize handles
        for (const corner of ['tl', 'tr', 'bl', 'br']) {
          if (this.isPointNearHandle({ x: mouseX, y: mouseY }, handles[corner])) {
            this.currentAction = "resize";
            this.activeHandle = corner;
            this.resizingFixedCorner = { 
              tl: 'br', tr: 'bl', bl: 'tr', br: 'tl'
            }[corner];
            
            // Store the original annotation with all properties
            this.originalAnnotation = JSON.parse(JSON.stringify(this.selectedAnnotation));
            
            // Store fixed corner location in rotated space
            const fixedCornerPos = handles[this.resizingFixedCorner];
            this.fixedCornerX = fixedCornerPos.x;
            this.fixedCornerY = fixedCornerPos.y;
            
            return;
          }
        }
      }
      
      // Check if we clicked on an existing annotation
      for (let i = this.annotations.length - 1; i >= 0; i--) {
        const ann = this.annotations[i];
        if (this.isPointInAnnotation(ann, mouseX, mouseY)) {
          this.selectedAnnotation = ann;
          this.currentAction = "move";
          this.offset = { x: mouseX - ann.cx, y: mouseY - ann.cy };
          this.drawCanvas();
          return;
        }
      }
      
      // If we didn't click on anything, start drawing a new annotation
      this.selectedAnnotation = null;
      
      if (this.currentMode === "rectangle") {
        this.currentAction = "draw";
        this.rectStart = { x: mouseX, y: mouseY };
        this.currentDrawingAnnotation = {
          type: "rectangle",
          cx: mouseX,
          cy: mouseY,
          width: 0,
          height: 0,
          rotation: 0
        };
      } else if (this.currentMode === "freehand") {
        this.currentAction = "draw";
        this.freehandPoints = [{ x: mouseX, y: mouseY }];
        this.currentDrawingAnnotation = {
          type: "freehand",
          points: [...this.freehandPoints]
        };
      }
      
      this.drawCanvas();
    }
  
    handleMouseMove(e) {
      if (this.usingLens) return;
      
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      switch (this.currentAction) {
        case "move":
          if (this.selectedAnnotation) {
            this.selectedAnnotation.cx = mouseX - this.offset.x;
            this.selectedAnnotation.cy = mouseY - this.offset.y;
            this.selectedAnnotation = this.boundaryCheck(this.selectedAnnotation);
            this.drawCanvas();
          }
          break;
          
        case "resize":
          if (this.selectedAnnotation && this.selectedAnnotation.type === "rectangle" && this.originalAnnotation) {
            // Get original rotation from stored annotation
            const rotation = this.originalAnnotation.rotation;
            
            // Get the fixed corner position from when we started the resize
            const fixedCornerX = this.fixedCornerX;
            const fixedCornerY = this.fixedCornerY;

            // Transform mouse coordinates to rectangle's rotated coordinate system
            const translatedMouseX = mouseX - fixedCornerX;
            const translatedMouseY = mouseY - fixedCornerY;
            
            // Rotate to align with rectangle's orientation
            const cos = Math.cos(-rotation);
            const sin = Math.sin(-rotation);
            const rotatedMouseX = translatedMouseX * cos - translatedMouseY * sin;
            const rotatedMouseY = translatedMouseX * sin + translatedMouseY * cos;
            
            // Calculate dimensions in rotated space - allow very small sizes (5px minimum)
            const width = Math.max(5, Math.abs(rotatedMouseX));
            const height = Math.max(5, Math.abs(rotatedMouseY));
            
            // Calculate center point
            // First determine the direction of resize based on which corner is being dragged
            const dirX = rotatedMouseX >= 0 ? 1 : -1;
            const dirY = rotatedMouseY >= 0 ? 1 : -1;
            
            // Calculate new center point in rotated space
            const rotatedCenterX = (width / 2) * dirX;
            const rotatedCenterY = (height / 2) * dirY;
            
            // Transform center back to screen space
            const screenCos = Math.cos(rotation);
            const screenSin = Math.sin(rotation);
            const centerOffsetX = rotatedCenterX * screenCos - rotatedCenterY * screenSin;
            const centerOffsetY = rotatedCenterX * screenSin + rotatedCenterY * screenCos;
            
            // Final center position
            const centerX = fixedCornerX + centerOffsetX;
            const centerY = fixedCornerY + centerOffsetY;
            
            // Update the rectangle
            this.selectedAnnotation.width = width;
            this.selectedAnnotation.height = height;
            this.selectedAnnotation.cx = centerX;
            this.selectedAnnotation.cy = centerY;
            this.selectedAnnotation.rotation = rotation; // Preserve the original rotation
            
            // Apply boundary check
            this.selectedAnnotation = this.boundaryCheck(this.selectedAnnotation);
            this.drawCanvas();
          }
          break;
          
        case "rotate":
          if (this.selectedAnnotation && this.selectedAnnotation.type === "rectangle") {
            const newAngle = Math.atan2(mouseY - this.selectedAnnotation.cy, mouseX - this.selectedAnnotation.cx);
            const angleDiff = newAngle - this.originalMouseAngle;
            this.selectedAnnotation.rotation = this.originalAnnotationRotation + angleDiff;
            
            // Apply boundary check after rotation
            this.selectedAnnotation = this.boundaryCheck(this.selectedAnnotation);
            
            this.drawCanvas();
          }
          break;
          
        case "draw":
          if (this.currentMode === "rectangle" && this.rectStart) {
            const width = Math.abs(mouseX - this.rectStart.x);
            const height = Math.abs(mouseY - this.rectStart.y);
            const cx = (mouseX + this.rectStart.x) / 2;
            const cy = (mouseY + this.rectStart.y) / 2;
            
            this.currentDrawingAnnotation = {
              type: "rectangle",
              cx,
              cy,
              width,
              height,
              rotation: 0
            };
            
            this.currentDrawingAnnotation = this.boundaryCheck(this.currentDrawingAnnotation);
            this.drawCanvas();
          } else if (this.currentMode === "freehand") {
            // Store points but don't show them while drawing
            this.freehandPoints.push({ x: mouseX, y: mouseY });
            
            // Draw current path without points
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(this.sourceImage, 0, 0, this.canvas.width, this.canvas.height);
            
            // Draw existing annotations
            this.annotations.forEach(ann => this.drawAnnotation(ann, ann === this.selectedAnnotation));
            
            // Draw current freehand path
            this.ctx.beginPath();
            this.freehandPoints.forEach((pt, index) => {
              if (index === 0) this.ctx.moveTo(pt.x, pt.y);
              else this.ctx.lineTo(pt.x, pt.y);
            });
            
            // Draw white border first
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            
            // Then draw blue border
            this.ctx.strokeStyle = "blue";
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
          }
          break;
      }
    }
  
    handleMouseUp(e) {
      if (this.usingLens) return;
      
      // Handle end of resizing to ensure rotation is properly maintained
      if (this.currentAction === "resize") {
        this.handleResizeEnd();
      }
      
      if (this.currentAction === "draw") {
        if (this.currentMode === "rectangle") {
          const rect = this.canvas.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          
          const width = Math.abs(mouseX - this.rectStart.x);
          const height = Math.abs(mouseY - this.rectStart.y);
          
          if (width > 5 && height > 5) {
            const cx = (mouseX + this.rectStart.x) / 2;
            const cy = (mouseY + this.rectStart.y) / 2;
            
            const newAnnotation = {
              type: "rectangle",
              cx,
              cy,
              width,
              height,
              rotation: 0
            };
            
            const checkedAnnotation = this.boundaryCheck(newAnnotation);
            this.annotations.push(checkedAnnotation);
            this.selectedAnnotation = checkedAnnotation;
            
            if (this.isFirstDraw) {
              this.isFirstDraw = false;
              if (typeof window.setAnnotationStartTime === 'function') {
                window.setAnnotationStartTime();
              }
            }
            
            if (this.onAnnotationsChange) {
              this.onAnnotationsChange();
            }
          }
        } else if (this.currentMode === "freehand" && this.freehandPoints.length > 2) {
          // Simplify points using RDP algorithm with smaller tolerance
          const tolerance = 2;
          let simplified = this.rdp(this.freehandPoints, tolerance);
          
          // Auto-close shape if endpoints are close
          if (simplified.length > 2) {
            const first = simplified[0];
            const last = simplified[simplified.length - 1];
            if (Math.hypot(last.x - first.x, last.y - first.y) < 5) {
              simplified[simplified.length - 1] = { ...first };
            } else {
              simplified.push({ ...first });
            }
          }
          
          // Normalize to exactly 10 points if there are more
          if (simplified.length > 10) {
            simplified = this.normalizeToTenPoints(simplified);
          }
          
          const newAnnotation = {
            type: "freehand",
            points: simplified
          };
          
          const checkedAnnotation = this.boundaryCheck(newAnnotation);
          this.annotations.push(checkedAnnotation);
          this.selectedAnnotation = checkedAnnotation;
          
          if (this.isFirstDraw) {
            this.isFirstDraw = false;
            if (typeof window.setAnnotationStartTime === 'function') {
              window.setAnnotationStartTime();
            }
          }
          
          if (this.onAnnotationsChange) {
            this.onAnnotationsChange();
          }
        }
      }
      
      this.resetDrawingState();
      this.drawCanvas();
    }
  
    // Utility functions
    clamp(val, min, max) {
      return Math.min(Math.max(val, min), max);
    }
  
    // Public methods for external use
    getAnnotations() {
      return this.annotations;
    }
  
    setAnnotations(newAnnotations) {
      this.annotations = newAnnotations;
      this.drawCanvas();
    }
  
    // Get coordinates for a single annotation
    getAnnotationCoordinatesJSON(annotation) {
      // Calculate scale factors based on the original image dimensions
      const scaleX = this.sourceImage.naturalWidth / this.canvas.width;
      const scaleY = this.sourceImage.naturalHeight / this.canvas.height;
      
      if (annotation.type === "rectangle") {
        const hw = annotation.width / 2;
        const hh = annotation.height / 2;
        const cos = Math.cos(annotation.rotation);
        const sin = Math.sin(annotation.rotation);
        
        // Calculate corners in canvas space first
        const corners = [
          { x: annotation.cx + (-hw * cos - hh * sin), y: annotation.cy + (-hw * sin + hh * cos) }, // top-left
          { x: annotation.cx + (hw * cos - hh * sin), y: annotation.cy + (hw * sin + hh * cos) },   // top-right
          { x: annotation.cx + (hw * cos + hh * sin), y: annotation.cy + (hw * sin - hh * cos) },   // bottom-right
          { x: annotation.cx + (-hw * cos + hh * sin), y: annotation.cy + (-hw * sin - hh * cos) }  // bottom-left
        ];
        
        // Transform to original image space and round to integers
        return corners.map(pt => [
          Math.round(pt.x * scaleX),
          Math.round(pt.y * scaleY)
        ]);
      } else if (annotation.type === "freehand") {
        // For freehand, scale each point to original image space
        return annotation.points.map(pt => [
          Math.round(pt.x * scaleX),
          Math.round(pt.y * scaleY)
        ]);
      }
      return null;
    }
  
    // Get all annotations as JSON
    getAllAnnotationsJSON() {
      return JSON.stringify(this.annotations.map(ann => this.getAnnotationCoordinatesJSON(ann)));
    }
  
    getAnnotationCornersOriginal(ann) {
      // Calculate scale factors based on the original image dimensions
          const scaleX = this.sourceImage.naturalWidth / this.canvas.width;
          const scaleY = this.sourceImage.naturalHeight / this.canvas.height;
      
      if (ann.type === "rectangle") {
        const hw = ann.width / 2;
        const hh = ann.height / 2;
        const cos = Math.cos(ann.rotation);
        const sin = Math.sin(ann.rotation);
        
        // Calculate corners in canvas space first
        const corners = [
          { x: ann.cx + (-hw * cos - hh * sin), y: ann.cy + (-hw * sin + hh * cos) }, // top-left
          { x: ann.cx + (hw * cos - hh * sin), y: ann.cy + (hw * sin + hh * cos) },   // top-right
          { x: ann.cx + (hw * cos + hh * sin), y: ann.cy + (hw * sin - hh * cos) },   // bottom-right
          { x: ann.cx + (-hw * cos + hh * sin), y: ann.cy + (-hw * sin - hh * cos) }  // bottom-left
        ];
        
        // Transform to original image space
        return corners.map(pt => [
          Math.round(pt.x * scaleX),
          Math.round(pt.y * scaleY)
        ]);
      } else if (ann.type === "freehand") {
        // For freehand, simply scale each point
        return ann.points.map(pt => [
          Math.round(pt.x * scaleX),
          Math.round(pt.y * scaleY)
        ]);
      }
    }
  
    setupLensEventListeners() {
      if (!this.lens) return;
      
      const updateLensCursor = (e) => {
        if (!this.lens) return;
        const lensRect = this.lens.getBoundingClientRect();
        const x = e.clientX - lensRect.left;
        const y = e.clientY - lensRect.top;
        const margin = 10; // Smaller margin for better edge detection
        
        if (x < margin || x > lensRect.width - margin ||
            y < margin || y > lensRect.height - margin) {
          this.lens.style.cursor = "nwse-resize";
        } else {
          this.lens.style.cursor = "move";
        }
      };
      
      this.lens.moveHandler = (e) => {
        if (this.draggingLens) {
          const canvasRect = this.canvas.getBoundingClientRect();
          let newLeft = e.clientX - this.lensOffset.x;
          let newTop = e.clientY - this.lensOffset.y;
          
          // Keep lens within canvas bounds with a small margin
          const margin = 5;
          newLeft = Math.max(canvasRect.left - margin, Math.min(newLeft, canvasRect.right - this._lensSize + margin));
          newTop = Math.max(canvasRect.top - margin, Math.min(newTop, canvasRect.bottom - this._lensSize + margin));
          
          this.lens.style.left = newLeft + "px";
          this.lens.style.top = newTop + "px";
          
          this.updateLens();
        } else if (this.isResizingLens) {
          const dx = e.clientX - this.initialMousePos.x;
          const dy = e.clientY - this.initialMousePos.y;
          const delta = Math.max(Math.abs(dx), Math.abs(dy)) * (dx > 0 ? 1 : -1);
          let newSize = this.initialLensSize + delta;
          
          // Limit size (75px to 200px)
          newSize = Math.max(75, Math.min(newSize, 200));
          this._lensSize = newSize;
          
          // Update lens size
          this.lens.style.width = this._lensSize + "px";
          this.lens.style.height = this._lensSize + "px";
          
          // Update canvas size
          const lensCanvas = this.lens.querySelector("canvas");
          lensCanvas.width = this._lensSize;
          lensCanvas.height = this._lensSize;
          
          this.updateLens();
        }
      };
      
      this.lens.addEventListener("mousemove", updateLensCursor);
      
      this.lens.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const lensRect = this.lens.getBoundingClientRect();
        const x = e.clientX - lensRect.left;
        const y = e.clientY - lensRect.top;
        const margin = 10;
        
        if (x < margin || x > lensRect.width - margin ||
            y < margin || y > lensRect.height - margin) {
          this.isResizingLens = true;
          this.initialLensSize = this._lensSize;
          this.initialMousePos = { x: e.clientX, y: e.clientY };
        } else {
          this.draggingLens = true;
          this.lensOffset = { 
            x: e.clientX - lensRect.left, 
            y: e.clientY - lensRect.top 
          };
        }
      });
      
      this.lens.upHandler = () => {
        this.draggingLens = false;
        this.isResizingLens = false;
      };
      
      document.addEventListener("mousemove", this.lens.moveHandler);
      document.addEventListener("mouseup", this.lens.upHandler);
    }
  
    // Add a helper method for handling resize end
    handleResizeEnd() {
      if (this.currentAction === "resize" && this.selectedAnnotation && this.originalAnnotation) {
        // Apply any final adjustments to the resized annotation
        // This ensures rotation is properly maintained
        this.selectedAnnotation.rotation = this.originalAnnotation.rotation;
        
        // Clear original annotation reference
        this.originalAnnotation = null;
      }
    }
  
    // Add this method to temporarily clear displayed annotations (for magnifier mode)
    clearDisplayedAnnotations() {
      // Temporarily hide annotations when using magnifier in professional mode
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(this.sourceImage, 0, 0, this.canvas.width, this.canvas.height);
    }
  }
  
  // Export the CanvasManager class
  window.CanvasManager = CanvasManager;
  