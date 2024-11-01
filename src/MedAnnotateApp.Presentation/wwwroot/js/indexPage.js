document.addEventListener('DOMContentLoaded', function () {
    const nextButton = document.getElementById('next-button');
    const skipButton = document.getElementById('skip-button');
    const notPresentButton = document.getElementById('not-present-button');
    const endButton = document.getElementById('end-button');
    
    endButton.addEventListener('click', function () {
        let path = `/Identity/Logout`;
        if (window.annotatedMedData) path += `?medDataId=${window.annotatedMedData.id}`;
        console.log(window.annotatedMedData === null);
        
        fetch(path, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                // localStorage.removeItem('keywordStates');
                window.location.href = '/Identity/Login';
            } else {
                console.error("Failed to process data.");
            }
        })
        .catch(error => console.error('Error:', error));
    });

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const image = document.getElementById('image');
    const container = document.getElementById('image-container');
    const keywords = document.querySelectorAll('.keyword');
    
    let isDrawingDisabled = false;

    let isMagnifierActive = false;
    let isDraggingMagnifier = false;
    let isResizingMagnifier = false;
    let initialDiameter = 200; // Initial magnifier diameter
    let magnifierDiameter = initialDiameter;
    let initialMouseX, initialMouseY, initialMagnifierLeft, initialMagnifierTop;

    function magnify(imgID, zoom) {
        let img, glass, resizeHandle, bw;
        img = document.getElementById(imgID);

        // Create the magnifier glass
        glass = document.createElement("DIV");
        glass.setAttribute("class", "img-magnifier-glass");
        img.parentElement.insertBefore(glass, img);

        // Create the rectangular resize handle in the bottom-right corner
        resizeHandle = document.createElement("DIV");
        resizeHandle.setAttribute("class", "resize-handle");
        glass.appendChild(resizeHandle);

        // Set up the magnifier glass background
        glass.style.backgroundImage = `url('${img.src}')`;
        glass.style.backgroundRepeat = "no-repeat";
        glass.style.backgroundSize = `${img.width * zoom}px ${img.height * zoom}px`;

        // Set initial styles for magnifier
        bw = 3; // Border width
        glass.style.width = `${magnifierDiameter}px`;
        glass.style.height = `${magnifierDiameter}px`;
        glass.style.cursor = "grab";

        // Style the rectangular resize handle
        resizeHandle.style.width = "20px";
        resizeHandle.style.height = "20px";
        resizeHandle.style.position = "absolute";
        resizeHandle.style.right = "0";
        resizeHandle.style.bottom = "0";
        resizeHandle.style.cursor = "nwse-resize";
        resizeHandle.style.backgroundColor = "invisible"; // Handle color to indicate resizing

        // Toggle magnifier on right-click
        img.parentElement.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            isMagnifierActive = !isMagnifierActive;
            if (isMagnifierActive) {
                glass.style.display = "block";
                setMagnifierPosition(event); // Initial position at right-click
            } else {
                glass.style.display = "none";
            }
        });

        // Enable dragging or resizing on mousedown within the magnifier
        glass.addEventListener("mousedown", (e) => {
            if (e.target === resizeHandle) {
                isResizingMagnifier = true; // Start resizing if the handle is clicked
                initialMouseX = e.clientX;
                initialMouseY = e.clientY;
            } else {
                isDraggingMagnifier = true; // Start dragging if glass itself is clicked
                initialMouseX = e.clientX;
                initialMouseY = e.clientY;
                initialMagnifierLeft = glass.offsetLeft;
                initialMagnifierTop = glass.offsetTop;
                glass.style.cursor = "grabbing";
            }
            e.preventDefault();
        });

        // Update magnifier position and background on mousemove only while dragging or resizing
        document.addEventListener("mousemove", (e) => {
            if (isMagnifierActive && isDraggingMagnifier) {
                // Move the magnifier

                const dx = e.clientX - initialMouseX;
                const dy = e.clientY - initialMouseY;

                let newLeft = initialMagnifierLeft + dx;
                let newTop = initialMagnifierTop + dy;
                
                // Canvas boundaries
                const canvasRect = canvas.getBoundingClientRect();
                
                // Adjusted constraints for the magnifier within the canvas
                const maxLeft = canvasRect.width - glass.offsetWidth + 50;
                const maxTop = canvasRect.height - glass.offsetHeight + 50;
                
                // Constrain the new position within the canvas
                newLeft = Math.max(-70, Math.min(newLeft, maxLeft));
                newTop = Math.max(-70, Math.min(newTop, maxTop));

                // Apply the constrained position within the canvas
                glass.style.left = `${newLeft}px`;
                glass.style.top = `${newTop}px`;

                // Update the background position to maintain zoomed area alignment
                const imgRect = img.getBoundingClientRect();
                const glassRect = glass.getBoundingClientRect();
                const w = glass.offsetWidth / 2;
                const h = glass.offsetHeight / 2;
                const x = glassRect.left + w - imgRect.left;
                const y = glassRect.top + h - imgRect.top;
                glass.style.backgroundPosition = `-${(x * zoom - w + bw)}px -${(y * zoom - h + bw)}px`;
            } else if (isMagnifierActive && isResizingMagnifier) {
                // Resize the magnifier smoothly with less sensitivity
                const dx = e.clientX - initialMouseX;
                const dy = e.clientY - initialMouseY;
                const delta = Math.min(Math.max(130, magnifierDiameter + (dx + dy) * 0.04), 300); // Smoother, slower resizing
                magnifierDiameter = delta;

                // Apply new diameter
                glass.style.width = `${magnifierDiameter}px`;
                glass.style.height = `${magnifierDiameter}px`;

                // Update background size to maintain zoom level
                glass.style.backgroundSize = `${img.width * zoom}px ${img.height * zoom}px`;
            }
        });

        // Stop dragging or resizing on mouseup
        document.addEventListener("mouseup", () => {
            isDraggingMagnifier = false;
            isResizingMagnifier = false;
            glass.style.cursor = "grab";
        });

        // Set the initial position of the magnifier based on right-click location
        function setMagnifierPosition(e) {
            const pos = getCursorPos(e, img);
            const x = pos.x;
            const y = pos.y;
            const w = glass.offsetWidth / 2;
            const h = glass.offsetHeight / 2;

            // Center the magnifier at the cursor with an offset
            glass.style.left = `${x + img.getBoundingClientRect().left - img.parentElement.getBoundingClientRect().left - w}px`;
            glass.style.top = `${y + img.getBoundingClientRect().top - img.parentElement.getBoundingClientRect().top - h}px`;

            // Set the background position to zoom in on the exact spot
            glass.style.backgroundPosition = `-${(x * zoom - w + bw)}px -${(y * zoom - h + bw)}px`;
        }

        // Get cursor position relative to the image
        function getCursorPos(e) {
            const a = img.getBoundingClientRect();
            const x = e.pageX - a.left - window.pageXOffset;
            const y = e.pageY - a.top - window.pageYOffset;
            return { x, y };
        }
    }

    // Initialize magnifier with image ID and zoom level
    magnify("image", 3);
    
    // 1 - not annotated; 2 - annotated; 3 - current; 4 - skipped
    let keywordStatesJson = localStorage.getItem("keywordStates");
    let keywordStates = JSON.parse(keywordStatesJson) || Array.from({ length: keywords.length }, (_, i) => (i === 0 ? 3 : 1));
    
    let startToDrawStart = Date.now();
    let startToDrawEnd;
    let drawToNextStart;
    let isFirstDraw = true; // Flag to ensure first draw on current keyword
    
    function removeAllKeywordClasses(element) { 
        element.classList.forEach(className => {
            if (className.includes('_')) {
                element.classList.remove(className);
            }
        });
    }
    
    if (keywordStatesJson) {    
        for (let i = 0; i < keywords.length; i++) {
            let curr = keywords[i];
            removeAllKeywordClasses(curr);
            if (keywordStates[i] == 1) {
                curr.classList.add('not_annotated_keyword');
            } else if (keywordStates[i] == 2) {
                curr.classList.add('annotated_keyword');
            } else if (keywordStates[i] == 3) {
                curr.classList.add('current_keyword');
            } else if (keywordStates[i] == 4) {
                curr.classList.add('skipped_keyword');
            }
        }
        if (keywordStates[keywords.length-1] === 2 ||  keywordStates[keywords.length-1] === 4) {
            nextButton.textContent = "Next Image";
            nextButton.removeAttribute('disabled');
            skipButton.setAttribute('disabled', 'true');
            notPresentButton.setAttribute('disabled', 'true');
            isDrawingDisabled = true;
        }
    }
    

    // Initialize canvas size based on container
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    let isDrawing = false, isDragging = false, isResizing = false;  
    let startX, startY, dragOffsetX, dragOffsetY, resizeDirection;
    let rect = { x: 0, y: 0, width: 0, height: 0 };

    function getRectangleCorners() {
        const scaleCoefficient = image.naturalWidth / image.clientWidth;

        return {
            topLeft: {
                x: rect.x * scaleCoefficient,
                y: rect.y * scaleCoefficient
            },
            topRight: {
                x: (rect.x + rect.width) * scaleCoefficient,
                y: rect.y * scaleCoefficient
            },
            bottomLeft: {
                x: rect.x * scaleCoefficient,
                y: (rect.y + rect.height) * scaleCoefficient
            },
            bottomRight: {
                x: (rect.x + rect.width) * scaleCoefficient,
                y: (rect.y + rect.height) * scaleCoefficient
            }
        };
    }

    function updateButtonState() {
        if (rect.width > 0 && rect.height > 0) {
            nextButton.disabled = false;
        } else {
            nextButton.disabled = true;
        }
    }
    
    // Mouse down event
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0 && isMagnifierActive === false) {
            if (isFirstDraw) {
                startToDrawEnd = Date.now();
                drawToNextStart = Date.now(); // Draw-to-Next timestamp starts
                isFirstDraw = false;
            }
    
            if (isDrawingDisabled) return;
    
            const { offsetX, offsetY } = e;
            if (isCorner(offsetX, offsetY)) {
                isResizing = true;
                resizeDirection = getResizeDirection(offsetX, offsetY);
            } else if (isInsideRect(offsetX, offsetY)) {
                isDragging = true;
                dragOffsetX = offsetX - rect.x;
                dragOffsetY = offsetY - rect.y;
            } else {
                isDrawing = true;
                startX = offsetX;
                startY = offsetY;
                rect = { x: startX, y: startY, width: 0, height: 0 };
            }
        }
    });

    // Mouse move event
    canvas.addEventListener('mousemove', (e) => {
        if (isDrawingDisabled) return;
 
        const { offsetX, offsetY } = e;
        if (isDrawing) {
            rect.width = Math.max(0, offsetX - startX);
            rect.height = Math.max(0, offsetY - startY);
        } else if (isDragging) {
            rect.x = Math.min(Math.max(offsetX - dragOffsetX, 0), canvas.width - rect.width);
            rect.y = Math.min(Math.max(offsetY - dragOffsetY, 0), canvas.height - rect.height);
        } else if (isResizing) {
            resizeRectangle(offsetX, offsetY);
        }
        drawCanvas();
    });

    // Mouse up event
    canvas.addEventListener('mouseup', () => {
        isDrawing = false;
        isDragging = false;
        isResizing = false;
    });

    // Function to draw the rectangle and corner handles
    function drawCanvas() {
        if (isDrawingDisabled) return;
 
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#a9000e';
        ctx.lineWidth = 2;

        if (rect.width > 0 && rect.height > 0) {
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
            drawHandles();
        }

        updateButtonState();
    }

    // Draw corner handles with dynamic size
    function drawHandles() {
        const minDim = Math.min(rect.width, rect.height);

        const handleLength = Math.max(0.06, minDim * 0.07); // Scale handles based on rectangle size

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;

        // Top-left corner
        ctx.beginPath();
        ctx.moveTo(rect.x, rect.y);
        ctx.lineTo(rect.x + handleLength, rect.y);
        ctx.moveTo(rect.x, rect.y);
        ctx.lineTo(rect.x, rect.y + handleLength);
        ctx.stroke();

        // Top-right corner
        ctx.beginPath();
        ctx.moveTo(rect.x + rect.width, rect.y);
        ctx.lineTo(rect.x + rect.width - handleLength, rect.y);
        ctx.moveTo(rect.x + rect.width, rect.y);
        ctx.lineTo(rect.x + rect.width, rect.y + handleLength);
        ctx.stroke();

        // Bottom-left corner
        ctx.beginPath();
        ctx.moveTo(rect.x, rect.y + rect.height);
        ctx.lineTo(rect.x + handleLength, rect.y + rect.height);
        ctx.moveTo(rect.x, rect.y + rect.height);
        ctx.lineTo(rect.x, rect.y + rect.height - handleLength);
        ctx.stroke();

        // Bottom-right corner
        ctx.beginPath();
        ctx.moveTo(rect.x + rect.width, rect.y + rect.height);
        ctx.lineTo(rect.x + rect.width - handleLength, rect.y + rect.height);
        ctx.moveTo(rect.x + rect.width, rect.y + rect.height);
        ctx.lineTo(rect.x + rect.width, rect.y + rect.height - handleLength);
        ctx.stroke();
    }

    // Check if a point is inside the rectangle
    function isInsideRect(x, y) {
        return x > rect.x && x < rect.x + rect.width && y > rect.y && y < rect.y + rect.height;
    }

    // Check if a point is near a corner handle for resizing
    function isCorner(x, y) {
        return ['top-left', 'top-right', 'bottom-left', 'bottom-right'].some(corner => isInHandle(x, y, corner));
    }

    // Check if point is inside a specific handle
    function isInHandle(x, y, corner) {
        const minDim = Math.min(rect.width, rect.height);
        const handleLength = Math.max(5, minDim * 0.1);
        const corners = {
            'top-left': { x: rect.x, y: rect.y },
            'top-right': { x: rect.x + rect.width, y: rect.y },
            'bottom-left': { x: rect.x, y: rect.y + rect.height },
            'bottom-right': { x: rect.x + rect.width, y: rect.y + rect.height }
        };
        const { x: hx, y: hy } = corners[corner];
        return x >= hx - handleLength && x <= hx + handleLength && y >= hy - handleLength && y <= hy + handleLength;
    }

    // Get the resize direction based on the corner
    function getResizeDirection(x, y) {
        if (isInHandle(x, y, 'top-left')) return 'top-left';
        if (isInHandle(x, y, 'top-right')) return 'top-right';
        if (isInHandle(x, y, 'bottom-left')) return 'bottom-left';
        if (isInHandle(x, y, 'bottom-right')) return 'bottom-right';
        return '';
    }

    // Resize the rectangle based on the mouse position and resize direction
    function resizeRectangle(x, y) {
        switch (resizeDirection) {
            case 'top-left':
                rect.width += rect.x - x;
                rect.height += rect.y - y;
                rect.x = x;
                rect.y = y;
                break;
            case 'top-right':
                rect.width = x - rect.x;
                rect.height += rect.y - y;
                rect.y = y;
                break;
            case 'bottom-left':
                rect.width += rect.x - x;
                rect.x = x;
                rect.height = y - rect.y;
                break;
            case 'bottom-right':
                rect.width = x - rect.x;
                rect.height = y - rect.y;
                break;
        }

        // Ensure the rectangle stays within canvas boundaries when resizing
        rect.width = Math.max(0, Math.min(rect.width, canvas.width - rect.x));
        rect.height = Math.max(0, Math.min(rect.height, canvas.height - rect.y));
    }

    function resetRectangle() {
        rect = { x: 0, y: 0, width: 0, height: 0 };
        drawCanvas(); // Redraws the canvas to clear the rectangle
        updateButtonState();
    }

    function changeNextWordToImage() {
        nextButton.textContent = "Next Image";
        nextButton.removeAttribute('disabled');
        skipButton.setAttribute('disabled', 'true');
        notPresentButton.setAttribute('disabled', 'true');
        isDrawingDisabled = true;
    }

    function resetTimestamps() {
        isFirstDraw = true;
        startToDrawStart = Date.now();
    }

    nextButton.addEventListener('click', function () {
        if (nextButton.textContent.trim() === "Save and Next" ) {

            const currentKeyword = document.querySelector('.current_keyword');
            
            if (currentKeyword) {
                let medData = window.annotatedMedData;
                const corners = getRectangleCorners();

                const annotatedMedData = {
                    Id: medData.id,
                    ImageUrl: medData.imageUrl,
                    ImageDescription: medData.imageDescription,
                    Sex: medData.sex,
                    Age: medData.age,
                    SkinTone: medData.skinTone,
                    BodyRegion: medData.bodyRegion,
                    Diagnosis: medData.diagnosis,
                    TreatmentName: medData.treatmentName,
                    Speciality: medData.speciality,
                    Modality: medData.modality,
                    BoxCoordinates: `[(${corners.topLeft.x},${corners.topLeft.y}),(${corners.bottomLeft.x},${corners.bottomLeft.y}),(${corners.bottomRight.x},${corners.bottomRight.y}),(${corners.topRight.x},${corners.topRight.y})]`,
                    ExtractedKeyword: currentKeyword.textContent,
                    PressedButton: "Save and Next",
                    Timestamps: `(${(startToDrawEnd - startToDrawStart) / 1000},${(Date.now() - drawToNextStart) / 1000})`
                };                          

                fetch('/MedData/ProcessAnnotatedMedData', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(annotatedMedData)
                })
                .then(response => response.json())
                .then(result => {
                    if (result.success) {
                        let currentIndex = Number(currentKeyword.id.split('-')[1]);

                        currentKeyword.classList.remove('current_keyword');
                        currentKeyword.classList.add('annotated_keyword');
                        keywordStates[currentIndex] = 2;

                        const nextKeyword = currentKeyword.nextElementSibling;

                        if (nextKeyword && nextKeyword.classList.contains('not_annotated_keyword')) {
                            nextKeyword.classList.remove('not_annotated_keyword');
                            nextKeyword.classList.add('current_keyword');
                            keywordStates[currentIndex+1] = 3;

                            localStorage.setItem('keywordStates', JSON.stringify(keywordStates));
                        } else {
                            resetRectangle();
                            changeNextWordToImage();
                            localStorage.setItem('keywordStates', JSON.stringify(keywordStates));
                            return;
                        }
                        
                        resetRectangle();
                        resetTimestamps();
                    } else {
                        console.error("Failed to process data.");
                    }
                })
                .catch(error => console.error('Error:', error));
            }
        } else {
            fetch(`/MedData/NextImage?medDataId=${window.annotatedMedData.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    localStorage.removeItem('keywordStates');
                    resetRectangle();
                    resetTimestamps();
                    location.reload();
                    location.reload();
                } else {
                    console.error("Failed to process data.");
                }
            })
            .catch(error => console.error('Error:', error));
        }
    });

    

    function skipOrNotPresentHandler(event) {
        const currentKeyword = document.querySelector('.current_keyword');
        if (currentKeyword) {
            let medData = window.annotatedMedData;
            
            const annotatedMedData = {
                Id: medData.id,
                ImageUrl: medData.imageUrl,
                ImageDescription: medData.imageDescription,
                Sex: medData.sex,
                Age: medData.age,
                SkinTone: medData.skinTone,
                BodyRegion: medData.bodyRegion,
                Diagnosis: medData.diagnosis,
                TreatmentName: medData.treatmentName,
                Speciality: medData.speciality,
                Modality: medData.modality,
                PressedButton: event.target.id === 'skip-button' ? "Location Uncertain" : "Not Visible",
                ExtractedKeyword: currentKeyword.textContent,
            };            

            fetch('/MedData/ProcessAnnotatedMedData', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(annotatedMedData)
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {

                    let currentIndex = Number(currentKeyword.id.split('-')[1]);

                    currentKeyword.classList.remove('current_keyword');
                    currentKeyword.classList.add('skipped_keyword');
                    keywordStates[currentIndex] = 4;

                    const nextKeyword = currentKeyword.nextElementSibling;

                    if (nextKeyword && nextKeyword.classList.contains('not_annotated_keyword')) {
                        nextKeyword.classList.remove('not_annotated_keyword');
                        nextKeyword.classList.add('current_keyword');
                        keywordStates[currentIndex+1] = 3;
                        
                        localStorage.setItem('keywordStates', JSON.stringify(keywordStates));
                    } else {
                        resetRectangle();
                        changeNextWordToImage();
                        localStorage.setItem('keywordStates', JSON.stringify(keywordStates));
                        return;
                    }
                    
                    resetRectangle();

                    startToDrawStart = Date.now();
                } else {
                    console.error("Failed to process data.");
                }
            })
            .catch(error => console.error('Error:', error));
        }
    }

    skipButton.addEventListener('click', skipOrNotPresentHandler);
    notPresentButton.addEventListener('click', skipOrNotPresentHandler);
});