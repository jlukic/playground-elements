/**
 * @license
 * Copyright (c) 2020 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {ESTABLISH_HANDSHAKE} from './shared/worker-api.js';

export interface ProxyInitMessage {
  port: MessagePort;
  url: string;
  scope: string;
}

(async () => {
  try {
    // Note we detect same-origin here by actually trying to access the parent
    // window. We can't trust the parent to compare the origins of the URLs,
    // because a redirect could have lead us back to the same origin.
    parent.window.console.warn(
      'Playground sandbox is executing with the same origin as its parent.',
      'This could be a security risk.',
      'https://github.com/PolymerLabs/playground-elements#security'
    );
  } catch {}

  // Wait for our parent to send us:
  // 1. The URL and scope of the Service Worker to register.
  // 2. A MessagePort, on which we'll forward up new Service Worker ports.
  const {url, scope, port: parentPort} = await new Promise<ProxyInitMessage>(
    (resolve) => {
      const listener = (event: MessageEvent<ProxyInitMessage>) => {
        window.removeEventListener('message', listener);
        resolve(event.data);
      };
      window.addEventListener('message', listener);
    }
  );

  const registration = await navigator.serviceWorker.register(
    new URL(url, import.meta.url).href,
    {scope}
  );

  const connect = (sw: ServiceWorker) => {
    const {port1, port2} = new MessageChannel();
    parentPort.postMessage(port1, [port1]);
    sw.postMessage({initComlink: ESTABLISH_HANDSHAKE, port: port2}, [port2]);
  };

  registration.addEventListener('updatefound', () => {
    // We can get a new service worker at any time, so we need to listen for
    // updates and connect to new workers on demand.
    if (registration.installing) {
      connect(registration.installing);
    }
  });

  if (registration.active) {
    connect(registration.active);
  }
})();
