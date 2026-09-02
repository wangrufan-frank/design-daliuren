import * as THREE from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";

type ActiveLease = {
  loader: KTX2Loader;
  references: number;
};

let active: ActiveLease | undefined;

export function basisTranscoderPath(baseUrl: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}three/basis/`;
}

export function acquireKtx2Loader(renderer: THREE.WebGLRenderer) {
  if (!active) {
    const loader = new KTX2Loader();
    try {
      loader.setTranscoderPath(basisTranscoderPath(import.meta.env.BASE_URL)).detectSupport(renderer);
    } catch (cause) {
      loader.dispose();
      throw cause;
    }
    active = { loader, references: 0 };
  }

  const lease = active;
  lease.references += 1;
  let released = false;

  return {
    loader: lease.loader,
    release() {
      if (released) return;
      released = true;
      lease.references -= 1;
      if (lease.references === 0 && active === lease) {
        lease.loader.dispose();
        active = undefined;
      }
    },
  };
}
