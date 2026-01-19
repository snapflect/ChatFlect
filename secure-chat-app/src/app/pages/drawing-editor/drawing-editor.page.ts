import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { ModalController, ToastController, LoadingController } from '@ionic/angular';
import { DrawingEditorService } from 'src/app/services/drawing-editor.service';
import { StatusService } from 'src/app/services/status.service';

@Component({
    selector: 'app-drawing-editor',
    templateUrl: './drawing-editor.page.html',
    styleUrls: ['./drawing-editor.page.scss'],
    standalone: false
})
export class DrawingEditorPage implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('canvasContainer', { static: false }) canvasContainer!: ElementRef;

    // Tool state
    selectedTool = 'pencil';
    selectedColor = '#FFFFFF';
    selectedBrushSize = 5;
    isDrawing = true;

    // Panel visibility
    showColorPicker = false;
    showBrushSizer = false;
    showEmojiPicker = false;
    showTextInput = false;

    // Text input
    textInput = '';

    // Background image (optional, passed from parent)
    backgroundImage: string | null = null;

    // Expose service properties
    tools = this.drawingEditor.tools;
    colors = this.drawingEditor.colors;
    brushSizes = this.drawingEditor.brushSizes;
    emojis = this.drawingEditor.emojis;

    constructor(
        private modalCtrl: ModalController,
        private drawingEditor: DrawingEditorService,
        private statusService: StatusService,
        private toast: ToastController,
        private loading: LoadingController
    ) { }

    ngOnInit() { }

    ngAfterViewInit() {
        setTimeout(() => this.initializeCanvas(), 100);
    }

    ngOnDestroy() {
        this.drawingEditor.dispose();
    }

    private initializeCanvas() {
        const container = this.canvasContainer?.nativeElement;
        if (!container) return;

        const width = container.offsetWidth || window.innerWidth;
        const height = container.offsetHeight || window.innerHeight - 200;

        this.drawingEditor.initCanvas('drawingCanvas', width, height);
        this.drawingEditor.setDrawingMode(true);
        this.drawingEditor.setBrushColor(this.selectedColor);
        this.drawingEditor.setBrushSize(this.selectedBrushSize);

        // If background image was provided, load it
        if (this.backgroundImage) {
            this.drawingEditor.setBackgroundImage(this.backgroundImage);
        }
    }

    selectTool(toolId: string) {
        this.selectedTool = toolId;
        this.hideAllPanels();

        switch (toolId) {
            case 'pencil':
            case 'brush':
                this.drawingEditor.setDrawingMode(true);
                this.drawingEditor.setEraserMode(false);
                break;
            case 'eraser':
                this.drawingEditor.setEraserMode(true);
                break;
            case 'text':
                this.drawingEditor.setDrawingMode(false);
                this.showTextInput = true;
                break;
            case 'emoji':
                this.drawingEditor.setDrawingMode(false);
                this.showEmojiPicker = true;
                break;
        }
    }

    toggleColorPicker() {
        this.hideAllPanels();
        this.showColorPicker = !this.showColorPicker;
    }

    toggleBrushSizer() {
        this.hideAllPanels();
        this.showBrushSizer = !this.showBrushSizer;
    }

    selectColor(color: string) {
        this.selectedColor = color;
        this.drawingEditor.setBrushColor(color);
        this.showColorPicker = false;
    }

    selectBrushSize(size: number) {
        this.selectedBrushSize = size;
        this.drawingEditor.setBrushSize(size);
        this.showBrushSizer = false;
    }

    addEmoji(emoji: string) {
        this.drawingEditor.addEmoji(emoji);
        this.showEmojiPicker = false;
    }

    addText() {
        if (this.textInput.trim()) {
            this.drawingEditor.addText(this.textInput, { fill: this.selectedColor });
            this.textInput = '';
        }
        this.showTextInput = false;
    }

    undo() {
        this.drawingEditor.undo();
    }

    clearAll() {
        this.drawingEditor.clearAll();
    }

    deleteSelected() {
        this.drawingEditor.deleteSelected();
    }

    hideAllPanels() {
        this.showColorPicker = false;
        this.showBrushSizer = false;
        this.showEmojiPicker = false;
        this.showTextInput = false;
    }

    async saveAndPost() {
        const loader = await this.loading.create({ message: 'Saving...' });
        await loader.present();

        try {
            const blob = await this.drawingEditor.exportAsBlob('png');
            const file = new File([blob], 'drawing-status.png', { type: 'image/png' });

            await this.statusService.uploadStatus(file, '', 'image', 'everyone').toPromise();

            loader.dismiss();
            const t = await this.toast.create({ message: 'Status posted!', duration: 2000 });
            t.present();

            this.closeModal(true);
        } catch (error) {
            loader.dismiss();
            const t = await this.toast.create({ message: 'Failed to post', duration: 2000 });
            t.present();
        }
    }

    async saveToDevice() {
        try {
            const dataUrl = this.drawingEditor.exportAsDataUrl('png');

            // Create download link
            const link = document.createElement('a');
            link.download = `drawing-${Date.now()}.png`;
            link.href = dataUrl;
            link.click();

            const t = await this.toast.create({ message: 'Saved!', duration: 1500 });
            t.present();
        } catch (error) {
            const t = await this.toast.create({ message: 'Failed to save', duration: 2000 });
            t.present();
        }
    }

    closeModal(success: boolean = false) {
        this.modalCtrl.dismiss({ success });
    }
}
