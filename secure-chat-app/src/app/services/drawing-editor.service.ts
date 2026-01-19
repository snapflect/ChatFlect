import { Injectable } from '@angular/core';

declare var fabric: any;

export interface DrawingTool {
    id: string;
    name: string;
    icon: string;
}

export interface StickerData {
    id: string;
    url: string;
    category: string;
}

@Injectable({
    providedIn: 'root'
})
export class DrawingEditorService {
    private canvas: any = null;
    private isDrawingMode = false;

    // Available drawing tools
    readonly tools: DrawingTool[] = [
        { id: 'pencil', name: 'Pencil', icon: 'pencil-outline' },
        { id: 'brush', name: 'Brush', icon: 'brush-outline' },
        { id: 'eraser', name: 'Eraser', icon: 'cut-outline' },
        { id: 'text', name: 'Text', icon: 'text-outline' },
        { id: 'emoji', name: 'Emoji', icon: 'happy-outline' }
    ];

    // Available colors
    readonly colors = [
        '#FFFFFF', '#000000', '#FF5252', '#FF4081', '#E040FB',
        '#7C4DFF', '#536DFE', '#448AFF', '#18FFFF', '#64FFDA',
        '#69F0AE', '#B2FF59', '#EEFF41', '#FFFF00', '#FFD740',
        '#FFAB40', '#FF6E40'
    ];

    // Brush sizes
    readonly brushSizes = [2, 5, 10, 15, 20];

    // Popular emojis for stickers
    readonly emojis = [
        '😀', '😂', '🥰', '😎', '🤩', '😍', '🥳', '😇',
        '❤️', '🔥', '💯', '⭐', '✨', '🎉', '👍', '👎',
        '🙌', '👏', '💪', '🙏', '🤝', '✌️', '🤟', '🤘'
    ];

    constructor() { }

    /**
     * Initialize fabric canvas
     */
    initCanvas(canvasId: string, width: number, height: number): void {
        if (typeof fabric === 'undefined') {
            console.error('Fabric.js not loaded');
            return;
        }

        this.canvas = new fabric.Canvas(canvasId, {
            isDrawingMode: false,
            width: width,
            height: height,
            backgroundColor: 'transparent'
        });

        // Setup default brush
        this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
        this.canvas.freeDrawingBrush.width = 5;
        this.canvas.freeDrawingBrush.color = '#FFFFFF';
    }

    /**
     * Load background image
     */
    setBackgroundImage(imageUrl: string): Promise<void> {
        return new Promise((resolve, reject) => {
            fabric.Image.fromURL(imageUrl, (img: any) => {
                if (!this.canvas) {
                    reject('Canvas not initialized');
                    return;
                }

                // Scale image to fit canvas
                const scaleX = this.canvas.width / img.width;
                const scaleY = this.canvas.height / img.height;
                const scale = Math.max(scaleX, scaleY);

                img.set({
                    scaleX: scale,
                    scaleY: scale,
                    originX: 'center',
                    originY: 'center',
                    left: this.canvas.width / 2,
                    top: this.canvas.height / 2
                });

                this.canvas.setBackgroundImage(img, this.canvas.renderAll.bind(this.canvas));
                resolve();
            }, { crossOrigin: 'anonymous' });
        });
    }

    /**
     * Enable/disable drawing mode
     */
    setDrawingMode(enabled: boolean): void {
        if (!this.canvas) return;
        this.isDrawingMode = enabled;
        this.canvas.isDrawingMode = enabled;
    }

    /**
     * Set brush color
     */
    setBrushColor(color: string): void {
        if (!this.canvas) return;
        this.canvas.freeDrawingBrush.color = color;
    }

    /**
     * Set brush size
     */
    setBrushSize(size: number): void {
        if (!this.canvas) return;
        this.canvas.freeDrawingBrush.width = size;
    }

    /**
     * Set eraser mode
     */
    setEraserMode(enabled: boolean): void {
        if (!this.canvas) return;
        if (enabled) {
            this.canvas.freeDrawingBrush.color = 'rgba(0,0,0,0)';
            this.canvas.freeDrawingBrush.width = 20;
            this.canvas.globalCompositeOperation = 'destination-out';
        } else {
            this.canvas.globalCompositeOperation = 'source-over';
        }
        this.canvas.isDrawingMode = enabled;
    }

    /**
     * Add text to canvas
     */
    addText(text: string, options?: any): void {
        if (!this.canvas) return;

        const textObj = new fabric.IText(text, {
            left: this.canvas.width / 2,
            top: this.canvas.height / 2,
            fontFamily: 'sans-serif',
            fontSize: 40,
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeWidth: 1,
            originX: 'center',
            originY: 'center',
            ...options
        });

        this.canvas.add(textObj);
        this.canvas.setActiveObject(textObj);
        this.canvas.renderAll();
    }

    /**
     * Add emoji/sticker to canvas
     */
    addEmoji(emoji: string): void {
        if (!this.canvas) return;

        const text = new fabric.Text(emoji, {
            left: this.canvas.width / 2,
            top: this.canvas.height / 2,
            fontSize: 80,
            originX: 'center',
            originY: 'center'
        });

        this.canvas.add(text);
        this.canvas.setActiveObject(text);
        this.canvas.renderAll();
    }

    /**
     * Add sticker image
     */
    addSticker(stickerUrl: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.canvas) {
                reject('Canvas not initialized');
                return;
            }

            fabric.Image.fromURL(stickerUrl, (img: any) => {
                img.set({
                    left: this.canvas.width / 2,
                    top: this.canvas.height / 2,
                    originX: 'center',
                    originY: 'center',
                    scaleX: 0.5,
                    scaleY: 0.5
                });

                this.canvas.add(img);
                this.canvas.setActiveObject(img);
                this.canvas.renderAll();
                resolve();
            }, { crossOrigin: 'anonymous' });
        });
    }

    /**
     * Delete selected object
     */
    deleteSelected(): void {
        if (!this.canvas) return;
        const activeObject = this.canvas.getActiveObject();
        if (activeObject) {
            this.canvas.remove(activeObject);
            this.canvas.renderAll();
        }
    }

    /**
     * Undo last action
     */
    undo(): void {
        if (!this.canvas) return;
        const objects = this.canvas.getObjects();
        if (objects.length > 0) {
            this.canvas.remove(objects[objects.length - 1]);
            this.canvas.renderAll();
        }
    }

    /**
     * Clear all drawings (keep background)
     */
    clearAll(): void {
        if (!this.canvas) return;
        this.canvas.getObjects().forEach((obj: any) => {
            this.canvas.remove(obj);
        });
        this.canvas.renderAll();
    }

    /**
     * Export canvas as image blob
     */
    exportAsBlob(format: 'png' | 'jpeg' = 'png', quality: number = 0.92): Promise<Blob> {
        return new Promise((resolve, reject) => {
            if (!this.canvas) {
                reject('Canvas not initialized');
                return;
            }

            const dataUrl = this.canvas.toDataURL({
                format: format,
                quality: quality
            });

            // Convert data URL to Blob
            fetch(dataUrl)
                .then(res => res.blob())
                .then(blob => resolve(blob))
                .catch(err => reject(err));
        });
    }

    /**
     * Export canvas as data URL
     */
    exportAsDataUrl(format: 'png' | 'jpeg' = 'png'): string {
        if (!this.canvas) return '';
        return this.canvas.toDataURL({ format });
    }

    /**
     * Dispose canvas
     */
    dispose(): void {
        if (this.canvas) {
            this.canvas.dispose();
            this.canvas = null;
        }
    }

    /**
     * Get canvas instance
     */
    getCanvas(): any {
        return this.canvas;
    }

    /**
     * Check if canvas is initialized
     */
    isInitialized(): boolean {
        return this.canvas !== null;
    }
}
