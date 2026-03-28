// writing.js

export function initWritingUI() {
    const html = `
        <div class="section-block" id="writing-task-1" style="margin-bottom: 2rem;">
            <div class="section-block-header">
                <div class="section-block-title">Task 1</div>
            </div>
            
            <div class="form-group">
                <label>Instructions <span class="required">*</span></label>
                <textarea class="t1-instructions form-input" rows="3" placeholder="e.g., You should spend about 20 minutes on this task. The graph below shows..."></textarea>
            </div>
            
            <div class="form-group">
                <label>Prompt Question <span class="required">*</span></label>
                <input type="text" class="t1-prompt form-input" placeholder="e.g., Summarise the information by selecting and reporting the main features...">
            </div>

            <div class="passage-image-upload">
                <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Attach Diagram/Chart Image <span class="required">*</span></label>
                <input type="file" id="t1-image" accept="image/*" class="form-input" style="padding: 0.5rem;">
                <p style="font-size: 0.8rem; color: #666; margin-top: 5px;">Images are strongly recommended for Task 1 formatting.</p>
            </div>
        </div>

        <div class="section-block" id="writing-task-2">
            <div class="section-block-header">
                <div class="section-block-title">Task 2</div>
            </div>
            
            <div class="form-group">
                <label>Instructions <span class="required">*</span></label>
                <textarea class="t2-instructions form-input" rows="3" placeholder="e.g., You should spend about 40 minutes on this task."></textarea>
            </div>
            
            <div class="form-group">
                <label>Topic Statement <span class="required">*</span></label>
                <textarea class="t2-topic form-input" rows="4" placeholder="e.g., Some people believe that university education should be free for everyone..."></textarea>
            </div>

            <div class="form-group">
                <label>Prompt Question <span class="required">*</span></label>
                <input type="text" class="t2-prompt form-input" placeholder="e.g., To what extent do you agree or disagree?">
            </div>
        </div>
    `;

    document.getElementById('writingTasksContainer').innerHTML = html;
}

export async function collectWritingData() {
    const t1Inst = document.querySelector('.t1-instructions').value.trim();
    const t1Prompt = document.querySelector('.t1-prompt').value.trim();
    const t2Inst = document.querySelector('.t2-instructions').value.trim();
    const t2Topic = document.querySelector('.t2-topic').value.trim();
    const t2Prompt = document.querySelector('.t2-prompt').value.trim();

    if (!t1Inst || !t1Prompt) {
         throw new Error("Writing Task 1 is incomplete.");
    }

    if (!t2Inst || !t2Topic || !t2Prompt) {
         throw new Error("Writing Task 2 is incomplete.");
    }

    const t1ImageInput = document.getElementById('t1-image');
    let t1ImageRef = null;
    if (t1ImageInput.files[0]) {
         t1ImageRef = { file: t1ImageInput.files[0], task: "task1" };
    }

    const task1 = {
        question: `${t1Inst}\n\n${t1Prompt}`,
        ...(t1ImageRef ? { imageUrl: t1ImageRef } : {})
    };
    const task2 = {
        question: `${t2Inst}\n\n${t2Topic}\n\n${t2Prompt}`
    };

    const writingTasksEntry = {
        // testId/title set later by main when full mock testId/title are known
        task1,
        task2
    };

    return {
        id: "writing",
        title: "Writing Test",
        duration: 60,
        task1,
        task2,
        tasks: [writingTasksEntry]
    };
}
