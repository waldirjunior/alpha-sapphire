interface FadeSurface {
  style: { opacity: string; transition: string };
}

const delay = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 120));

export async function transitionMap(surface: FadeSurface, effect: number | undefined, apply: () => void): Promise<void> {
  if (!effect) { apply(); return; }
  const previous = { opacity: surface.style.opacity, transition: surface.style.transition };
  surface.style.transition = 'opacity 120ms ease';
  surface.style.opacity = '0';
  try {
    await delay();
    apply();
    surface.style.opacity = '1';
    await delay();
  } finally {
    Object.assign(surface.style, previous);
  }
}
