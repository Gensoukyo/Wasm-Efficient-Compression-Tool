document.addEventListener('DOMContentLoaded', init);

const worker = new Worker('worker.js');
worker.onmessage = e => {
    switch (e.data.type) {
        case 'ready':
        case 'stdout':
            log(e.data.data);
            break;
        case 'stderr':
            logError(e.data.data);
            break;
        case 'done':
            showResult(e.data.data);
            break;
    }
};

let currentTask = {};

function init() {
    const inputFile = document.querySelector('.input-file');
    inputFile.onchange = e => {
        const file = e.target.files[0];
        processFile(file);
    };

    const dragTarget = document.querySelector('.drag-target');
    const dragError = document.querySelector('.drag-error');
    dragTarget.onclick = () => {
        inputFile.value = '';
        inputFile.click();
    };
    dragTarget.ondragover = e => {
        e.preventDefault();
        dragTarget.classList.add('dragged');
        dragError.style.display = 'none';
    };
    dragTarget.ondragleave = e => {
        e.preventDefault();
        dragTarget.classList.remove('dragged');
    };
    dragTarget.ondrop = e => {
        e.preventDefault();
        dragTarget.classList.remove('dragged');
        for (const file of e.dataTransfer.files) {
            processFile(file);
            break;
        }
    };
    document.querySelector('.sel-colors').onchange = imageParamsChanged;
    document.querySelector('.link-download').onclick = e => {
        e.preventDefault();
        downloadImage();
    };
}

let logEl;
let logStart;

function initLog() {
    logEl = document.querySelector('.log');
    logEl.innerHTML = '';
    logStart = performance.now();
}

function log(msg) {
    let logTime = Math.round(performance.now() - logStart).toString();
    while (logTime.length < 5) {
        logTime = ' ' + logTime;
    }
    logEl.innerHTML += `[${logTime}ms] ${msg}\n`;
}

function logError(msg) {
    log('ERROR ' + msg);
}

function getOptions() {
    return {
        [document.querySelector('.sel-colors').value]: '',
        ...document.querySelector('.sel-dithering').value && { progressive: '' }
    };
}

function processFile(file) {
    initLog();
    currentTask = { fileName: file.name, inProgress: true };
    const dragError = document.querySelector('.drag-error');
    if (file.type != 'image/png' && file.type != 'image/jpeg' && file.type != 'image/jpg') {
        dragError.innerHTML = 'We support only PNG, JPG files.';
        dragError.style.display = 'block';
        return;
    }
    log('Loading file data');
    const reader = new FileReader();
    reader.onload = e => {
        const result = e.target.result;
        const fileName = file.name;
        const fileSize = result.byteLength;
        currentTask.buffer = result.slice(0);
        log(`File data loaded: ${fileName}, ${fileSize} bytes`);
        processImage(result, getOptions(), fileName);
    };
    reader.onerror = () => {
        dragError.innerHTML = 'Cannot load image.';
        dragError.style.display = 'block';
    };
    reader.readAsArrayBuffer(file);
}

function processImage(araayBuffer, option, fileName) {
    const imagesAreaEl = document.querySelector('.images');
    imagesAreaEl.innerHTML = '';
    const workAreaEl = document.querySelector('.work');
    workAreaEl.style.display = 'flex';
    document.querySelector('.link-download').style.display = 'none';
    appendImageToImages(araayBuffer, 'img-original').catch(e => {
        logError(e);
    });
    worker.postMessage({
        type: 'image',
        arguments: option,
        data: araayBuffer,
        fileName
    }, [araayBuffer]);
}

function imageParamsChanged() {
    if (!currentTask.buffer || currentTask.inProgress) {
        return;
    }
    const imgResult = document.querySelector('.img-result');
    if (imgResult) {
        imgResult.parentNode.removeChild(imgResult);
    }
    const { fileName, buffer } = currentTask;
    currentTask = {
        fileName,
        inProgress: true,
        buffer: buffer.slice(0)
    }
    initLog();
    processImage(buffer, getOptions(), fileName);
}

function showResult({ file: result }) {
    appendImageToImages(result, 'img-result');
    currentTask.inProgress = false;
    currentTask.result = result;
    if (document.querySelector('.check-auto-download').checked) {
        downloadImage();
    } else {
        document.querySelector('.link-download').style.display = 'inline-block';
    }
}

function showErrorResult(error) {
    logError(error);
    currentTask.inProgress = false;
}

function downloadImage() {
    const compressedBlob = new Blob([currentTask.result]);
    const url = URL.createObjectURL(compressedBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = currentTask.fileName.replace(/\.(.+)$/, '.min.$1');
    link.style = 'display: none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
}

function appendImageToImages(data, cls) {
    return new Promise((resolve, reject) => {
        const blob = new File([data], currentTask.fileName.replace(/\.(.+)$/, '.min.$1'));
        const imageUrl = URL.createObjectURL(blob);
        const imageEl = document.createElement('img');
        imageEl.style.display = 'none';
        imageEl.src = imageUrl;
        imageEl.className = cls;
        imageEl.onload = e => {
            imageEl.origWidth = imageEl.width;
            imageEl.origHeight = imageEl.height;
            const imagesAreaEl = document.querySelector('.images');
            imagesAreaEl.appendChild(imageEl);
            imageEl.style.display = 'block';
            URL.revokeObjectURL(imageUrl);
            resolve(imageEl);
        };
        imageEl.onerror = e => {
            reject('Error loading image, maybe it\'s not in Image format?');
        };
    });
}
