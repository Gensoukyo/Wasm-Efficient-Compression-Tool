let INPUT_FILE = '/input.png';
let OUTPUT_FILE = '/input.png';

function print(data) {
  postMessage({ type: 'stdout', data });
}

function printErr(data) {
  postMessage({ type: 'stderr', data });
}

function processArgs(options) {
  /* Default arguments to append -new.png to input file name */
  /* Create command line options to passed using input `options` object */
  /* eslint-disable */
  const args = [];
  for (let key in options) {
    if (!options.hasOwnProperty(key)) continue;
    /* Prepend -- to option key name */
    if (options[key] !== undefined) {
      args.push('-' + key);
      args.push(options[key]);
    }
  }
  args.push(INPUT_FILE);
  /* eslint-enable */
  return args.filter(v => v);
}

function getMemoFile(FS) {
  let file = null;
  /* Test if processed image has been mounted at input-new.png */
  try {
    /* read processed image data in file var */
    console.log(FS.readdir('/'));
    file = FS.readFile(OUTPUT_FILE);
  } catch (e) {
    /* Cleaning up input png from MEMFS */
    FS.unlink(INPUT_FILE);
    throw e;
  }

  /* Cleanup files from */
  FS.unlink(OUTPUT_FILE);
  if (INPUT_FILE !== OUTPUT_FILE) {
    FS.unlink(INPUT_FILE);
  }

  return file.buffer;
}

const defaultModule = {
  locateFile: path => `/dist/${path}`,
  print,
  printErr
};

importScripts('dist/ect.js');

self.onmessage = e => {
    if (e.data.fileName) {
      INPUT_FILE = e.data.fileName;
      OUTPUT_FILE = e.data.fileName;
    }
    switch (e.data.type) {
        case 'image':
            processImage(e);
            break;
    }
};

function processImage(e) {
    const { arguments: option, data } = e.data;
    const args = processArgs(option);
    const startT = performance.now();

    console.log(args);
    try {
      const mod = Module({
        ...defaultModule,
        arguments: args,
        preRun() {
          mod.writeFile(INPUT_FILE, new Uint8Array(data));
        },
        postRun() {
          let buffer;
          try {
            buffer = getMemoFile(mod);
          } catch (err) {
            return printErr({ type: 'stderr', data: err.message });
          }
          const endT = performance.now();
          return postMessage({
            type: 'done',
            data: {
              file: buffer,
              time: endT - startT
            }
          }, [buffer]);
        }
      });
    } catch (err) {
      printErr({ type: 'stderr', data: err.message });
    }
}
