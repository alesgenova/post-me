import {
  ParentHandshake,
  WindowMessenger,
  WorkerMessenger,
} from './ibridge.esm.js';

let title = 'Parent';
let color = '#eeeeee';

const container = document.getElementById(`parent-container`);
const titleElement = document.createElement('h1');
titleElement.innerHTML = title;
container.appendChild(titleElement);
container.style.backgroundColor = color;
const childrenControlsContainer = document.createElement('div');
container.appendChild(childrenControlsContainer);
const workerControlsContainer = document.createElement('div');
container.appendChild(workerControlsContainer);

const methods = {
  getTitle: () => title,
  setTitle: (t) => {
    title = t;
    titleElement.innerHTML = title;
  },
  getColor: () => color,
  setColor: (c) => {
    color = c;
    container.style.backgroundColor = color;
  },
};

const children = [0, 1, 2, 3];

const defaultTitles = {
  0: 'Child 0',
  1: 'Child 1',
  2: 'Child 2',
  3: 'Child 3',
};

const defaultColors = {
  0: '#eeaaaa',
  1: '#aaeeaa',
  2: '#aaaaee',
  3: '#eeeeaa',
};

const createChildWindow = (i) => {
  return new Promise((resolve) => {
    const childContainer = document.getElementById(`child${i}-container`);
    const childFrame = document.createElement('iframe');
    childFrame.src = './child.html';
    childFrame.width = '100%';
    childFrame.height = '100%';
    childContainer.appendChild(childFrame);
    childFrame.onload = () => {
      const childWindow = childFrame.contentWindow;
      resolve(childWindow);
    };
  });
};

const makeHandshake = (i, childWindow) => {
  const messenger = new WindowMessenger({
    localWindow: window,
    remoteWindow: childWindow,
    remoteOrigin: '*',
  });
  return ParentHandshake(methods, messenger);
};

const createChildControls = (i, controlsContainer, connection) => {
  const localHandle = connection.localHandle();
  const remoteHandle = connection.remoteHandle();

  const defaultTitle = defaultTitles[i];
  const defaultColor = defaultColors[i];
  remoteHandle.call('setTitle', defaultTitle);
  remoteHandle.call('setColor', defaultColor);

  const title = document.createElement('h4');
  title.innerHTML = `Child ${i}`;
  controlsContainer.appendChild(title);

  {
    const section = document.createElement('div');
    section.style.marginBottom = '0.5rem';
    const input = document.createElement('input');
    input.style.width = '10rem';
    input.value = defaultTitle;
    const button = document.createElement('button');
    button.innerHTML = 'Set Title';
    button.onclick = () => {
      remoteHandle.call('setTitle', input.value);
    };
    section.appendChild(input);
    section.appendChild(button);
    controlsContainer.appendChild(section);
  }

  {
    const section = document.createElement('div');
    section.style.marginBottom = '0.5rem';
    const input = document.createElement('input');
    input.style.width = '10rem';
    input.value = defaultColor;
    const button = document.createElement('button');
    button.innerHTML = 'Set Color';
    button.onclick = () => {
      remoteHandle.call('setColor', input.value);
    };
    section.appendChild(input);
    section.appendChild(button);
    controlsContainer.appendChild(section);
  }

  {
    const section = document.createElement('div');
    section.style.marginBottom = '0.5rem';
    const button = document.createElement('button');
    button.innerHTML = 'Emit ping event';
    button.onclick = () => {
      localHandle.emit('ping');
    };
    section.appendChild(button);
    controlsContainer.appendChild(section);
  }

  {
    const section = document.createElement('div');
    section.style.marginBottom = '0.5rem';
    let nPings = 0;
    const pingParagraph = document.createElement('span');
    pingParagraph.innerHTML = 'Ping events received: ';
    const pingSpan = document.createElement('span');
    pingSpan.innerHTML = nPings;
    pingSpan.style.fontWeight = 'bold';
    pingParagraph.appendChild(pingSpan);
    section.appendChild(pingParagraph);
    controlsContainer.appendChild(section);

    remoteHandle.addEventListener('ping', () => {
      nPings += 1;
      pingSpan.innerHTML = nPings;
    });
  }
};

const initChild = async (i) => {
  const controlsContainer = document.createElement('div');
  childrenControlsContainer.appendChild(controlsContainer);
  const childWindow = await createChildWindow(i);
  const connection = await makeHandshake(i, childWindow);
  createChildControls(i, controlsContainer, connection);
};

children.forEach((i) => initChild(i));

// Create the worker
{
  const worker = new Worker('./worker.js');

  const messenger = new WorkerMessenger({ worker });

  ParentHandshake({}, messenger).then((connection) => {
    const remoteHandle = connection.remoteHandle();

    const title = document.createElement('h4');
    title.innerHTML = `Worker`;
    workerControlsContainer.appendChild(title);

    {
      const section = document.createElement('div');
      section.style.marginBottom = '0.5rem';

      const inputA = document.createElement('input');
      inputA.style.width = '3rem';
      inputA.type = 'number';
      inputA.value = 1;

      const inputB = document.createElement('input');
      inputB.style.width = '3rem';
      inputB.type = 'number';
      inputB.value = 2;

      const inputR = document.createElement('input');
      inputR.style.width = '3rem';
      inputR.type = 'number';
      inputR.disabled = true;

      const button = document.createElement('button');
      button.innerHTML = 'Calculate';
      button.onclick = () => {
        remoteHandle
          .call('sum', parseFloat(inputA.value), parseFloat(inputB.value))
          .then((result) => {
            inputR.value = result;
          });
      };

      const opSpan = document.createElement('span');
      opSpan.innerHTML = ' + ';
      const eqSpan = document.createElement('span');
      eqSpan.innerHTML = ' = ';

      section.appendChild(inputA);
      section.appendChild(opSpan);
      section.appendChild(inputB);
      section.appendChild(eqSpan);
      section.appendChild(inputR);
      section.appendChild(button);
      workerControlsContainer.appendChild(section);
    }

    {
      const section = document.createElement('div');
      section.style.marginBottom = '0.5rem';

      const inputA = document.createElement('input');
      inputA.style.width = '3rem';
      inputA.type = 'number';
      inputA.value = 3;

      const inputB = document.createElement('input');
      inputB.style.width = '3rem';
      inputB.type = 'number';
      inputB.value = 4;

      const inputR = document.createElement('input');
      inputR.style.width = '3rem';
      inputR.type = 'number';
      inputR.disabled = true;

      const button = document.createElement('button');
      button.innerHTML = 'Calculate';
      button.onclick = () => {
        remoteHandle
          .call('mul', parseFloat(inputA.value), parseFloat(inputB.value))
          .then((result) => {
            inputR.value = result;
          });
      };

      const opSpan = document.createElement('span');
      opSpan.innerHTML = ' * ';
      const eqSpan = document.createElement('span');
      eqSpan.innerHTML = ' = ';

      section.appendChild(inputA);
      section.appendChild(opSpan);
      section.appendChild(inputB);
      section.appendChild(eqSpan);
      section.appendChild(inputR);
      section.appendChild(button);
      workerControlsContainer.appendChild(section);
    }
  });
}
