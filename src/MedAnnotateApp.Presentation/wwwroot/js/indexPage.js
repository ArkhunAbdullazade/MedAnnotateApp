// import Cropper from '../lib/cropperjs/cropper.js';
// import '../lib/cropperjs/cropper.min.css';

document.addEventListener('DOMContentLoaded', function () {
    const nextButton = document.getElementById('next-button');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const image = document.getElementById('image');
    const container = document.getElementById('image-container');

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

    // Mouse down event
    canvas.addEventListener('mousedown', (e) => {
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
    });

    // Mouse move event
    canvas.addEventListener('mousemove', (e) => {
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
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#a9000e';
        ctx.lineWidth = 2;
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

        drawHandles();
    }

    // Draw corner handles with dynamic size
    function drawHandles() {
        const minDim = Math.min(rect.width, rect.height);

        const handleLength = Math.max(0.06, minDim * 0.07); // Scale handles based on rectangle size

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;

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

    nextButton.addEventListener('click', function () {

        if (nextButton.textContent.trim() === "Next Word") {
            const currentKeyword = document.querySelector('.current_keyword');

            if (currentKeyword) {
                currentKeyword.classList.remove('current_keyword');
                currentKeyword.classList.add('annotated_keyword');

                const nextKeyword = currentKeyword.nextElementSibling;

                if (nextKeyword && nextKeyword.classList.contains('not_annotated_keyword')) {
                    nextKeyword.classList.remove('not_annotated_keyword');
                    nextKeyword.classList.add('current_keyword');
                } else {
                    nextButton.textContent = "Next Image";
                }

                if (rect.width > 0 && rect.height > 0) {
                    const corners = getRectangleCorners();
                    console.log('Rectangle Corners:', corners);
                }
            }
        } else {
            console.log("Next Image");
        }
    });
});