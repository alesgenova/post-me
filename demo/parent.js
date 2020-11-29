import { ParentHandshake } from './post-me.esm.js';

let title = 'Parent';
let color = '#eeeeee';

const container = document.getElementById(`parent-container`);
const titleElement = document.createElement('h1');
titleElement.innerHTML = title;
container.appendChild(titleElement);
container.style.backgroundColor = color;

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

const createChildFrame = (i) => {
  return new Promise((resolve) => {
    const childContainer = document.getElementById(`child${i}-container`);
    const childFrame = document.createElement('iframe');
    childFrame.src = './child.html';
    childFrame.width = '100%';
    childFrame.height = '100%';
    childContainer.appendChild(childFrame);
    childFrame.onload = () => {
      resolve(childFrame);
    };
  });
};

const makeHandshake = (i, childFrame) => {
  const childWindow = childFrame.contentWindow;
  return ParentHandshake(childWindow.origin, childWindow, methods);
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
  container.appendChild(controlsContainer);
  const childFrame = await createChildFrame(i);
  const connection = await makeHandshake(i, childFrame);
  createChildControls(i, controlsContainer, connection);
};

children.forEach((i) => initChild(i));
