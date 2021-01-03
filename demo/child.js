import { Child, WindowMessenger } from './ibridge.esm.js';

let title = '';
let color = '#ffffff';

const container = document.getElementById('container');
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

const messenger = new WindowMessenger({
  localWindow: window,
  remoteWindow: window.parent,
  remoteOrigin: '*',
});
new Child(messenger, methods).handshake().then((bridge) => {
  {
    const section = document.createElement('div');
    section.style.marginBottom = '0.5rem';
    const input = document.createElement('input');
    const button = document.createElement('button');
    button.innerHTML = 'Set Title';
    button.onclick = () => {
      bridge.call('setTitle', input.value);
    };
    section.appendChild(input);
    section.appendChild(button);
    container.appendChild(section);

    // Call a method on the parent to prepopulate the input
    bridge.call('getTitle').then((title) => (input.value = title));
  }

  {
    const section = document.createElement('div');
    section.style.marginBottom = '0.5rem';
    const input = document.createElement('input');
    const button = document.createElement('button');
    button.innerHTML = 'Set Color';
    button.onclick = () => {
      bridge.call('setColor', input.value);
    };
    section.appendChild(input);
    section.appendChild(button);
    container.appendChild(section);

    // Call a method on the parent to prepopulate the input
    bridge.call('getColor').then((color) => (input.value = color));
  }

  {
    const section = document.createElement('div');
    section.style.marginBottom = '0.5rem';
    const button = document.createElement('button');
    button.innerHTML = 'Emit ping event';
    button.onclick = () => {
      bridge.emit('ping');
    };
    section.appendChild(button);
    container.appendChild(section);
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
    container.appendChild(section);

    bridge.addEventListener('ping', () => {
      nPings += 1;
      pingSpan.innerHTML = nPings;
    });
  }
});
