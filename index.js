const video = document.getElementById('source-video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Set canvas size to match viewport
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function drawTiledVideo() {
    if (video.readyState < 2) {
        requestAnimationFrame(drawTiledVideo);
        return;
    }

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    const videoAspect = video.videoWidth / video.videoHeight;
    const screenAspect = canvasWidth / canvasHeight;
    const stripCount = 100;
    
    // Always fit video to screen width (edges glued to window)
    const videoWidth = canvasWidth;
    const videoHeight = videoWidth / videoAspect;
    
    // Calculate how much extra height we have
    const extraHeight = Math.max(0, canvasHeight - videoHeight);
    
    // Calculate reveal factor based on screen aspect ratio
    // Wide screens (desktop) = less reveal, tall screens (phone) = more reveal
    const revealFactor = Math.max(0, Math.min(1, (1.5 - screenAspect) / 1.2)); // 0 to 1
    
    // Height of top/bottom tiles based on available space and reveal factor
    const tileHeight = extraHeight * revealFactor / 2;
    
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    // Position ENTER buttons - always visible with smooth interpolation
    const topButton = document.getElementById('enter-top');
    const bottomButton = document.getElementById('enter-bottom');
    
    // Smooth interpolation factor based on available tile space
    // When tileHeight is large (tall screens), buttons go in gaps
    // When tileHeight is small (wide screens), buttons drift into center video
    const maxGapHeight = 80; // Maximum gap height for full separation
    const minGapHeight = 0;   // Minimum gap height for full drift
    
    // Interpolation factor: 0 = fully drifted into center, 1 = fully in gaps
    const gapFactor = Math.max(0, Math.min(1, (tileHeight - minGapHeight) / (maxGapHeight - minGapHeight)));
    
    // Gap positions (when buttons are between tiles)
    const topGapPos = centerY - videoHeight / 2 - 20;
    const bottomGapPos = centerY + videoHeight / 2 + 5;
    
    // Drift positions (when buttons are in center video extremities)
    // Ensure buttons stay within viewport bounds
    const buttonHeight = 35; // Approximate button height
    const margin = 20; // Minimum margin from screen edges
    
    const topDriftPos = Math.max(margin, centerY - videoHeight / 2 + 60);
    const bottomDriftPos = Math.min(canvasHeight - buttonHeight - margin, centerY + videoHeight / 2 - 60);
    
    // Smoothly interpolate between positions
    const topPos = topDriftPos + (topGapPos - topDriftPos) * gapFactor;
    const bottomPos = bottomDriftPos + (bottomGapPos - bottomDriftPos) * gapFactor;
    
    // Final clamp to ensure buttons are always visible
    const finalTopPos = Math.max(margin, Math.min(canvasHeight / 2 - buttonHeight - 10, topPos));
    const finalBottomPos = Math.max(canvasHeight / 2 + 10, Math.min(canvasHeight - buttonHeight - margin, bottomPos));
    
    topButton.style.top = finalTopPos + 'px';
    bottomButton.style.top = finalBottomPos + 'px';
    
    // Always show buttons
    topButton.classList.add('visible');
    bottomButton.classList.add('visible');

    // Draw center tile (normal) - always fits screen width
    ctx.drawImage(
        video,
        0, 0, video.videoWidth, video.videoHeight,
        0, centerY - videoHeight / 2,
        videoWidth, videoHeight
    );

    // Only draw top/bottom tiles if there's space to reveal them
    if (tileHeight > 0) {
        // Top and bottom videos are EXACTLY the same size as center video
        const mirrorTileHeight = videoHeight; // Same height as center video
        
        // Draw top tile (mirrored + perspective warp)
        for (let i = 0; i < stripCount; i++) {
            const t = i / stripCount;
            const srcY = t * video.videoHeight;
            const srcH = video.videoHeight / stripCount;

            // More dramatic perspective effect
            const perspectiveScale = 1 + t * 0.8; // Increased from 0.4 to 0.8
            const destW = videoWidth * perspectiveScale;
            const destH = mirrorTileHeight / stripCount;
            const destX = centerX - destW / 2;
            const destY = (centerY - videoHeight / 2) - (i + 1) * destH;

            // Fade from 100% opacity at center to 0% at outer edge (exponential falloff)
            const opacity = Math.pow(1 - t, 2.5); // Exponential falloff for more dramatic fade

            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.scale(1, -1);
            ctx.drawImage(
                video,
                0, srcY, video.videoWidth, srcH,
                destX, -destY - destH, destW, destH
            );
            ctx.restore();
        }

        // Draw bottom tile (mirrored + perspective warp)
        for (let i = 0; i < stripCount; i++) {
            const t = i / stripCount;
            const srcY = video.videoHeight - (t * video.videoHeight);
            const srcH = video.videoHeight / stripCount;

            const perspectiveScale = 1 + t * 0.8; // More dramatic perspective
            const destW = videoWidth * perspectiveScale;
            const destH = mirrorTileHeight / stripCount;
            const destX = centerX - destW / 2;
            const destY = (centerY + videoHeight / 2) + i * destH;

            // Fade from 100% opacity at center to 0% at outer edge (exponential falloff)
            const opacity = Math.pow(1 - t, 2.5); // Exponential falloff for more dramatic fade

            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.scale(1, -1);
            ctx.drawImage(
                video,
                0, srcY, video.videoWidth, srcH,
                destX, -destY - destH, destW, destH
            );
            ctx.restore();
        }
    }

    requestAnimationFrame(drawTiledVideo);
}

// Start drawing when video can play
video.addEventListener('canplay', function() {
    drawTiledVideo();
});

// Ensure video plays
video.play().catch(function(error) {
    console.log('Video autoplay failed:', error);
}); 