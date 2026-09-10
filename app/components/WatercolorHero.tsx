"use client";

import { useEffect, useRef } from "react";

const TEXTURE_URL = "/finkey-watercolor-hero-v2.png";
const MAX_DEVICE_PIXEL_RATIO = 1.75;
const MAX_RENDER_PIXELS = 2_400_000;
const SIMULATION_LONG_EDGE = 256;
const ACTIVE_FRAME_INTERVAL_MS = 1000 / 50;
const IDLE_FRAME_INTERVAL_MS = 1000 / 30;

const VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// This pass evolves a persistent, low-resolution flow map. RG stores velocity and
// BA stores the source-coordinate displacement of the pigment. Keeping the flow
// state on the GPU lets a drag leave a wake which keeps travelling after the
// pointer has moved on; it is deliberately not a one-frame UV ripple.
const SIMULATION_FRAGMENT_SHADER_SOURCE = `
  precision mediump float;

  uniform sampler2D u_previous_state;
  uniform vec2 u_texel;
  uniform vec2 u_pointer_from;
  uniform vec2 u_pointer_to;
  uniform vec2 u_pointer_velocity;
  uniform float u_interaction;
  uniform float u_idle_force;
  uniform float u_aspect;
  uniform float u_delta_time;
  uniform float u_time;

  varying vec2 v_uv;

  const float NEUTRAL = 128.0 / 255.0;
  const float DECODE_SCALE = 255.0 / 127.0;
  const float ENCODE_SCALE = 127.0 / 255.0;
  const float MAX_VELOCITY = 0.105;
  const float MAX_DISPLACEMENT = 0.092;
  const float TAU = 6.28318530718;

  vec2 decodeSigned(vec2 encoded) {
    return (encoded - NEUTRAL) * DECODE_SCALE;
  }

  vec2 encodeSigned(vec2 value) {
    return clamp(value * ENCODE_SCALE + NEUTRAL, 0.0, 1.0);
  }

  vec2 decodeVelocity(vec4 state) {
    return decodeSigned(state.rg) * MAX_VELOCITY;
  }

  vec2 decodeDisplacement(vec4 state) {
    return decodeSigned(state.ba) * MAX_DISPLACEMENT;
  }

  vec2 toPhysical(vec2 value) {
    return vec2(value.x * u_aspect, value.y);
  }

  vec2 fromPhysical(vec2 value) {
    return vec2(value.x / max(u_aspect, 0.001), value.y);
  }

  float segmentDistance(vec2 point, vec2 start, vec2 end, out float along) {
    vec2 segment = end - start;
    float lengthSquared = max(dot(segment, segment), 0.000001);
    along = clamp(dot(point - start, segment) / lengthSquared, 0.0, 1.0);
    return length(point - mix(start, end, along));
  }

  // Analytic curl fields are divergence-light and avoid a visibly repeating
  // scrolling texture. Their amplitude is intentionally tiny: the artwork is
  // always alive, but it should still read as a calm financial product surface.
  vec2 idleCurl(vec2 point, float time) {
    vec2 p1 = vec2(point.x / max(u_aspect, 0.001), point.y);
    float x1 = (p1.x * 1.15 + time * 0.010) * TAU;
    float y1 = (p1.y * 0.82 - time * 0.007) * TAU;
    vec2 curl1 = vec2(
      0.82 * sin(x1) * cos(y1),
      -1.15 * cos(x1) * sin(y1)
    );

    float x2 = (p1.x * 2.05 - time * 0.006) * TAU + 1.7;
    float y2 = (p1.y * 1.48 + time * 0.009) * TAU - 0.9;
    vec2 curl2 = vec2(
      1.48 * sin(x2) * cos(y2),
      -2.05 * cos(x2) * sin(y2)
    );

    return curl1 * 0.62 + curl2 * 0.18;
  }

  void main() {
    float dt = clamp(u_delta_time, 0.001, 0.04);

    vec4 currentState = texture2D(u_previous_state, v_uv);
    vec2 currentVelocity = decodeVelocity(currentState);
    vec2 backtraceUv = clamp(v_uv - currentVelocity * dt, vec2(0.002), vec2(0.998));

    vec4 advectedState = texture2D(u_previous_state, backtraceUv);
    vec2 velocity = decodeVelocity(advectedState);
    vec2 displacement = decodeDisplacement(advectedState);

    // A small viscosity step blends neighbouring momentum without erasing the
    // larger directional wake.
    vec2 neighbourVelocity =
      decodeVelocity(texture2D(u_previous_state, clamp(backtraceUv + vec2(u_texel.x, 0.0), 0.0, 1.0)))
      + decodeVelocity(texture2D(u_previous_state, clamp(backtraceUv - vec2(u_texel.x, 0.0), 0.0, 1.0)))
      + decodeVelocity(texture2D(u_previous_state, clamp(backtraceUv + vec2(0.0, u_texel.y), 0.0, 1.0)))
      + decodeVelocity(texture2D(u_previous_state, clamp(backtraceUv - vec2(0.0, u_texel.y), 0.0, 1.0)));
    velocity = mix(velocity, neighbourVelocity * 0.25, 0.075);

    vec2 pointPhysical = toPhysical(v_uv);
    vec2 fromPhysicalPointer = toPhysical(u_pointer_from);
    vec2 toPhysicalPointer = toPhysical(u_pointer_to);
    vec2 pointerVelocityPhysical = toPhysical(u_pointer_velocity);
    float pointerSpeed = min(length(pointerVelocityPhysical), 2.4);
    vec2 pointerDirection = pointerSpeed > 0.006
      ? pointerVelocityPhysical / pointerSpeed
      : normalize(toPhysicalPointer - fromPhysicalPointer + vec2(0.0001, 0.0));

    float along = 0.0;
    float distanceToDrag = segmentDistance(
      pointPhysical,
      fromPhysicalPointer,
      toPhysicalPointer,
      along
    );
    float radius = mix(0.082, 0.142, smoothstep(0.0, 1.45, pointerSpeed));
    float core = exp(-pow(distanceToDrag / max(radius, 0.001), 2.0) * 2.4);

    vec2 pointerDelta = pointPhysical - toPhysicalPointer;
    vec2 normal = vec2(-pointerDirection.y, pointerDirection.x);
    float behind = dot(pointerDelta, -pointerDirection);
    float side = dot(pointerDelta, normal);
    float wakeLength = radius * (2.8 + min(pointerSpeed, 1.8));
    float wake = exp(-pow(side / (radius * 0.78), 2.0) * 1.65)
      * exp(-pow(max(behind, 0.0) / max(wakeLength, 0.001), 2.0) * 1.25)
      * smoothstep(-radius * 0.3, radius * 0.8, behind);

    float contact = u_interaction * smoothstep(0.008, 0.065, pointerSpeed);
    vec2 dragForcePhysical = pointerDirection
      * pointerSpeed
      * (core * 0.72 + wake * 0.205);

    // A paired lateral component curls the two sides of the wake in opposite
    // directions, resembling dye/soap pulled through a shallow water surface.
    float sideRatio = clamp(side / max(radius, 0.001), -1.6, 1.6);
    vec2 wakeCurlPhysical = normal
      * (-sideRatio)
      * wake
      * pointerSpeed
      * 0.205;

    vec2 radialDirection = pointerDelta / max(length(pointerDelta), 0.001);
    vec2 surfacePushPhysical = radialDirection
      * core
      * (0.024 + pointerSpeed * 0.041);

    vec2 accelerationPhysical = (
      dragForcePhysical + wakeCurlPhysical + surfacePushPhysical
    ) * contact;
    accelerationPhysical += idleCurl(pointPhysical, u_time) * u_idle_force;
    velocity += fromPhysical(accelerationPhysical) * dt;

    // Momentum lingers long enough for the wake to keep moving after a pass.
    velocity *= exp(-dt * 0.68);

    vec2 velocityPhysical = toPhysical(velocity);
    float velocityMagnitude = length(velocityPhysical);
    if (velocityMagnitude > MAX_VELOCITY) {
      velocity = fromPhysical(velocityPhysical * (MAX_VELOCITY / velocityMagnitude));
    }

    // A passive source-coordinate map advects the original pigment. This is the
    // key distinction from rotating pixels around the current cursor position.
    displacement -= velocity * dt * 1.22;
    displacement *= exp(-dt * 0.19);

    vec2 displacementPhysical = toPhysical(displacement);
    float displacementMagnitude = length(displacementPhysical);
    if (displacementMagnitude > MAX_DISPLACEMENT) {
      displacement = fromPhysical(
        displacementPhysical * (MAX_DISPLACEMENT / displacementMagnitude)
      );
    }

    float edgeDistance = min(min(v_uv.x, 1.0 - v_uv.x), min(v_uv.y, 1.0 - v_uv.y));
    float edgeDamping = smoothstep(0.0, 0.045, edgeDistance);
    velocity *= mix(0.78, 1.0, edgeDamping);
    displacement *= mix(0.92, 1.0, edgeDamping);

    gl_FragColor = vec4(
      encodeSigned(velocity / MAX_VELOCITY),
      encodeSigned(displacement / MAX_DISPLACEMENT)
    );
  }
`;

const RENDER_FRAGMENT_SHADER_SOURCE = `
  precision mediump float;

  uniform sampler2D u_texture;
  uniform sampler2D u_state;
  uniform vec2 u_resolution;
  uniform vec2 u_texture_size;
  uniform vec2 u_state_texel;
  uniform float u_aspect;

  varying vec2 v_uv;

  const float NEUTRAL = 128.0 / 255.0;
  const float DECODE_SCALE = 255.0 / 127.0;
  const float MAX_VELOCITY = 0.105;
  const float MAX_DISPLACEMENT = 0.092;

  vec2 decodeSigned(vec2 encoded) {
    return (encoded - NEUTRAL) * DECODE_SCALE;
  }

  vec2 decodeVelocity(vec4 state) {
    return decodeSigned(state.rg) * MAX_VELOCITY;
  }

  vec2 decodeDisplacement(vec4 state) {
    return decodeSigned(state.ba) * MAX_DISPLACEMENT;
  }

  vec2 coverUv(vec2 uv) {
    float viewportAspect = u_resolution.x / max(u_resolution.y, 1.0);
    float textureAspect = u_texture_size.x / max(u_texture_size.y, 1.0);
    vec2 scale = vec2(1.0);

    if (viewportAspect > textureAspect) {
      scale.y = textureAspect / viewportAspect;
    } else {
      scale.x = viewportAspect / textureAspect;
    }

    return (uv - 0.5) * scale + 0.5;
  }

  vec3 pigmentAt(vec2 uv) {
    vec2 textureUv = clamp(coverUv(uv), vec2(0.001), vec2(0.999));
    return texture2D(u_texture, textureUv).rgb;
  }

  void main() {
    vec4 state = texture2D(u_state, v_uv);
    vec2 displacement = decodeDisplacement(state);
    vec2 velocity = decodeVelocity(state);

    vec2 displacementRight = decodeDisplacement(
      texture2D(u_state, clamp(v_uv + vec2(u_state_texel.x, 0.0), 0.0, 1.0))
    );
    vec2 displacementUp = decodeDisplacement(
      texture2D(u_state, clamp(v_uv + vec2(0.0, u_state_texel.y), 0.0, 1.0))
    );

    // Local flow gradients add a very small refractive fold at wake edges. The
    // pigment itself is still moved by the persistent advected coordinate map.
    vec2 fold = vec2(
      displacementRight.x - displacement.x,
      displacementUp.y - displacement.y
    ) * 0.19;
    vec2 fluidUv = v_uv + displacement * 1.1 + fold;
    vec2 smear = velocity * (0.017 + min(length(vec2(velocity.x * u_aspect, velocity.y)), 0.1) * 0.08);

    vec3 colour = pigmentAt(fluidUv) * 0.76;
    colour += pigmentAt(fluidUv + smear) * 0.13;
    colour += pigmentAt(fluidUv - smear * 0.72) * 0.11;

    gl_FragColor = vec4(colour, 1.0);
  }
`;

type WatercolorHeroProps = {
  className?: string;
};

type SimulationTargets = {
  framebuffers: [WebGLFramebuffer, WebGLFramebuffer];
  idleForce: number;
  textures: [WebGLTexture, WebGLTexture];
  width: number;
  height: number;
};

type ProgramResources = {
  positionBuffer: WebGLBuffer;
  positionLocation: number;
  renderProgram: WebGLProgram;
  simulationProgram: WebGLProgram;
  sourceTexture: WebGLTexture;
  stateIndex: number;
  targets: SimulationTargets | null;
  simulation: {
    aspect: WebGLUniformLocation;
    deltaTime: WebGLUniformLocation;
    idleForce: WebGLUniformLocation;
    interaction: WebGLUniformLocation;
    pointerFrom: WebGLUniformLocation;
    pointerTo: WebGLUniformLocation;
    pointerVelocity: WebGLUniformLocation;
    texel: WebGLUniformLocation;
    time: WebGLUniformLocation;
  };
  render: {
    aspect: WebGLUniformLocation;
    resolution: WebGLUniformLocation;
    stateTexel: WebGLUniformLocation;
    textureSize: WebGLUniformLocation;
  };
};

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  fragmentSource: string,
): WebGLProgram | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  if (!vertexShader || !fragmentShader) {
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

function requireUniform(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation | null {
  return gl.getUniformLocation(program, name);
}

function createSimulationTargets(
  gl: WebGLRenderingContext,
  width: number,
  height: number,
  textureType: number,
  idleForce: number,
): SimulationTargets | null {
  const textures: WebGLTexture[] = [];
  const framebuffers: WebGLFramebuffer[] = [];

  for (let index = 0; index < 2; index += 1) {
    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    if (!texture || !framebuffer) {
      if (texture) gl.deleteTexture(texture);
      if (framebuffer) gl.deleteFramebuffer(framebuffer);
      textures.forEach((item) => gl.deleteTexture(item));
      framebuffers.forEach((item) => gl.deleteFramebuffer(item));
      return null;
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      textureType,
      null,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteTexture(texture);
      gl.deleteFramebuffer(framebuffer);
      textures.forEach((item) => gl.deleteTexture(item));
      framebuffers.forEach((item) => gl.deleteFramebuffer(item));
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return null;
    }

    gl.clearColor(128 / 255, 128 / 255, 128 / 255, 128 / 255);
    gl.clear(gl.COLOR_BUFFER_BIT);

    textures.push(texture);
    framebuffers.push(framebuffer);
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);

  return {
    framebuffers: framebuffers as [WebGLFramebuffer, WebGLFramebuffer],
    height,
    idleForce,
    textures: textures as [WebGLTexture, WebGLTexture],
    width,
  };
}

function createBestSimulationTargets(
  gl: WebGLRenderingContext,
  width: number,
  height: number,
): SimulationTargets | null {
  const halfFloat = gl.getExtension("OES_texture_half_float") as {
    HALF_FLOAT_OES: number;
  } | null;
  const halfFloatLinear = gl.getExtension("OES_texture_half_float_linear");

  if (halfFloat && halfFloatLinear) {
    // FBO completeness is checked inside createSimulationTargets. Browsers that
    // expose half-float sampling but not half-float render targets fall through
    // safely to RGBA8.
    const halfFloatTargets = createSimulationTargets(
      gl,
      width,
      height,
      halfFloat.HALF_FLOAT_OES,
      0.00175,
    );
    if (halfFloatTargets) return halfFloatTargets;
  }

  // RGBA8 remains a broad WebGL1 fallback. Its idle force is slightly larger so
  // calm movement survives 8-bit state quantisation.
  return createSimulationTargets(gl, width, height, gl.UNSIGNED_BYTE, 0.0145);
}

function destroySimulationTargets(
  gl: WebGLRenderingContext,
  targets: SimulationTargets | null,
) {
  if (!targets) return;
  targets.textures.forEach((texture) => gl.deleteTexture(texture));
  targets.framebuffers.forEach((framebuffer) => gl.deleteFramebuffer(framebuffer));
}

function createProgramResources(
  gl: WebGLRenderingContext,
  image: HTMLImageElement,
): ProgramResources | null {
  const simulationProgram = createProgram(gl, SIMULATION_FRAGMENT_SHADER_SOURCE);
  const renderProgram = createProgram(gl, RENDER_FRAGMENT_SHADER_SOURCE);
  if (!simulationProgram || !renderProgram) {
    if (simulationProgram) gl.deleteProgram(simulationProgram);
    if (renderProgram) gl.deleteProgram(renderProgram);
    return null;
  }

  const positionBuffer = gl.createBuffer();
  const sourceTexture = gl.createTexture();
  const positionLocation = gl.getAttribLocation(renderProgram, "a_position");

  const simulation = {
    aspect: requireUniform(gl, simulationProgram, "u_aspect"),
    deltaTime: requireUniform(gl, simulationProgram, "u_delta_time"),
    idleForce: requireUniform(gl, simulationProgram, "u_idle_force"),
    interaction: requireUniform(gl, simulationProgram, "u_interaction"),
    pointerFrom: requireUniform(gl, simulationProgram, "u_pointer_from"),
    pointerTo: requireUniform(gl, simulationProgram, "u_pointer_to"),
    pointerVelocity: requireUniform(gl, simulationProgram, "u_pointer_velocity"),
    texel: requireUniform(gl, simulationProgram, "u_texel"),
    time: requireUniform(gl, simulationProgram, "u_time"),
  };
  const render = {
    aspect: requireUniform(gl, renderProgram, "u_aspect"),
    resolution: requireUniform(gl, renderProgram, "u_resolution"),
    stateTexel: requireUniform(gl, renderProgram, "u_state_texel"),
    textureSize: requireUniform(gl, renderProgram, "u_texture_size"),
  };

  if (
    !positionBuffer
    || !sourceTexture
    || positionLocation < 0
    || Object.values(simulation).some((location) => !location)
    || Object.values(render).some((location) => !location)
  ) {
    if (positionBuffer) gl.deleteBuffer(positionBuffer);
    if (sourceTexture) gl.deleteTexture(sourceTexture);
    gl.deleteProgram(simulationProgram);
    gl.deleteProgram(renderProgram);
    return null;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

  gl.useProgram(simulationProgram);
  gl.uniform1i(gl.getUniformLocation(simulationProgram, "u_previous_state"), 0);
  gl.useProgram(renderProgram);
  gl.uniform1i(gl.getUniformLocation(renderProgram, "u_texture"), 0);
  gl.uniform1i(gl.getUniformLocation(renderProgram, "u_state"), 1);
  gl.uniform2f(
    render.textureSize as WebGLUniformLocation,
    image.naturalWidth,
    image.naturalHeight,
  );

  return {
    positionBuffer,
    positionLocation,
    render: render as ProgramResources["render"],
    renderProgram,
    simulation: simulation as ProgramResources["simulation"],
    simulationProgram,
    sourceTexture,
    stateIndex: 0,
    targets: null,
  };
}

function destroyProgramResources(
  gl: WebGLRenderingContext,
  resources: ProgramResources | null,
) {
  if (!resources) return;
  destroySimulationTargets(gl, resources.targets);
  gl.deleteTexture(resources.sourceTexture);
  gl.deleteBuffer(resources.positionBuffer);
  gl.deleteProgram(resources.simulationProgram);
  gl.deleteProgram(resources.renderProgram);
}

function getSimulationSize(width: number, height: number) {
  const aspect = width / Math.max(height, 1);
  if (aspect >= 1) {
    return {
      height: Math.max(72, Math.round((SIMULATION_LONG_EDGE / aspect) / 4) * 4),
      width: SIMULATION_LONG_EDGE,
    };
  }

  return {
    height: SIMULATION_LONG_EDGE,
    width: Math.max(72, Math.round((SIMULATION_LONG_EDGE * aspect) / 4) * 4),
  };
}

export default function WatercolorHero({ className }: WatercolorHeroProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!root || !image || !canvas) return;

    let cancelled = false;
    let gl: WebGLRenderingContext | null = null;
    let resources: ProgramResources | null = null;
    let animationFrame = 0;
    let previousFrameTime = 0;
    let activeTime = 0;
    let isIntersecting = true;
    let contextLost = false;
    let needsResize = true;
    let interactionEnergy = 0;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
    const hoverPointerQuery = window.matchMedia("(hover: hover)");

    const pointer = [0.5, 0.5];
    const targetPointer = [0.5, 0.5];
    const pointerVelocity = [0, 0];
    const targetPointerVelocity = [0, 0];
    let hover = 0;
    let targetHover = 0;
    let lastPointerTime = 0;

    const canAnimate = () => (
      Boolean(resources?.targets)
      && !contextLost
      && isIntersecting
      && !document.hidden
      && !reducedMotionQuery.matches
    );

    const bindFullscreenGeometry = (program: WebGLProgram) => {
      if (!gl || !resources) return;
      const positionLocation = gl.getAttribLocation(program, "a_position");
      gl.bindBuffer(gl.ARRAY_BUFFER, resources.positionBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    };

    const resizeCanvas = () => {
      if (!gl || !resources) return;
      const bounds = root.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;

      let dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
      const requestedPixels = bounds.width * bounds.height * dpr * dpr;
      if (requestedPixels > MAX_RENDER_PIXELS) {
        dpr *= Math.sqrt(MAX_RENDER_PIXELS / requestedPixels);
      }

      const width = Math.max(1, Math.round(bounds.width * dpr));
      const height = Math.max(1, Math.round(bounds.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const simulationSize = getSimulationSize(bounds.width, bounds.height);
      if (
        !resources.targets
        || resources.targets.width !== simulationSize.width
        || resources.targets.height !== simulationSize.height
      ) {
        const nextTargets = createBestSimulationTargets(
          gl,
          simulationSize.width,
          simulationSize.height,
        );
        if (!nextTargets) {
          canvas.style.opacity = "0";
          return;
        }
        destroySimulationTargets(gl, resources.targets);
        resources.targets = nextTargets;
        resources.stateIndex = 0;
      }

      needsResize = false;
    };

    const stopAnimation = () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      previousFrameTime = 0;
    };

    const drawFrame = (frameTime: number) => {
      animationFrame = 0;
      if (!gl || !resources || !canAnimate()) return;

      const frameInterval = hover > 0.03 || interactionEnergy > 0.015
        ? ACTIVE_FRAME_INTERVAL_MS
        : IDLE_FRAME_INTERVAL_MS;
      if (previousFrameTime && frameTime - previousFrameTime < frameInterval) {
        animationFrame = window.requestAnimationFrame(drawFrame);
        return;
      }

      const elapsed = previousFrameTime
        ? Math.min((frameTime - previousFrameTime) / 1000, 0.04)
        : 1 / 60;
      previousFrameTime = frameTime;
      activeTime = (activeTime + elapsed) % 1024;

      if (needsResize) resizeCanvas();
      const targets = resources.targets;
      if (!targets) {
        animationFrame = window.requestAnimationFrame(drawFrame);
        return;
      }

      const pointerFromX = pointer[0];
      const pointerFromY = pointer[1];
      const pointerEase = 1 - Math.exp(-elapsed * 19);
      const velocityEase = 1 - Math.exp(-elapsed * 22);
      const hoverEase = 1 - Math.exp(-elapsed * 9);

      pointer[0] += (targetPointer[0] - pointer[0]) * pointerEase;
      pointer[1] += (targetPointer[1] - pointer[1]) * pointerEase;
      pointerVelocity[0] += (targetPointerVelocity[0] - pointerVelocity[0]) * velocityEase;
      pointerVelocity[1] += (targetPointerVelocity[1] - pointerVelocity[1]) * velocityEase;
      hover += (targetHover - hover) * hoverEase;

      const inputDecay = Math.exp(-elapsed * 11.5);
      targetPointerVelocity[0] *= inputDecay;
      targetPointerVelocity[1] *= inputDecay;
      interactionEnergy = Math.max(
        Math.hypot(pointerVelocity[0], pointerVelocity[1]),
        interactionEnergy * Math.exp(-elapsed * 2.2),
      );

      const readIndex = resources.stateIndex;
      const writeIndex = 1 - readIndex;
      const aspect = canvas.width / Math.max(canvas.height, 1);

      gl.bindFramebuffer(gl.FRAMEBUFFER, targets.framebuffers[writeIndex]);
      gl.viewport(0, 0, targets.width, targets.height);
      gl.useProgram(resources.simulationProgram);
      bindFullscreenGeometry(resources.simulationProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, targets.textures[readIndex]);
      gl.uniform2f(resources.simulation.texel, 1 / targets.width, 1 / targets.height);
      gl.uniform2f(resources.simulation.pointerFrom, pointerFromX, pointerFromY);
      gl.uniform2f(resources.simulation.pointerTo, pointer[0], pointer[1]);
      gl.uniform2f(
        resources.simulation.pointerVelocity,
        pointerVelocity[0],
        pointerVelocity[1],
      );
      gl.uniform1f(resources.simulation.interaction, Math.max(hover, targetHover * 0.88));
      gl.uniform1f(resources.simulation.idleForce, targets.idleForce);
      gl.uniform1f(resources.simulation.aspect, aspect);
      gl.uniform1f(resources.simulation.deltaTime, elapsed);
      gl.uniform1f(resources.simulation.time, activeTime);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      resources.stateIndex = writeIndex;

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(resources.renderProgram);
      bindFullscreenGeometry(resources.renderProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, resources.sourceTexture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, targets.textures[writeIndex]);
      gl.uniform2f(resources.render.resolution, canvas.width, canvas.height);
      gl.uniform2f(resources.render.stateTexel, 1 / targets.width, 1 / targets.height);
      gl.uniform1f(resources.render.aspect, aspect);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (canvas.style.opacity !== "1") canvas.style.opacity = "1";
      animationFrame = window.requestAnimationFrame(drawFrame);
    };

    const syncAnimation = () => {
      if (canAnimate()) {
        if (!animationFrame) animationFrame = window.requestAnimationFrame(drawFrame);
      } else {
        stopAnimation();
        if (reducedMotionQuery.matches) canvas.style.opacity = "0";
      }
    };

    const initializeWebGl = () => {
      if (cancelled || image.naturalWidth === 0 || image.naturalHeight === 0) return;

      gl = canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        failIfMajorPerformanceCaveat: true,
        powerPreference: "low-power",
        preserveDrawingBuffer: false,
        stencil: false,
      });
      if (!gl) return;

      resources = createProgramResources(gl, image);
      if (!resources) {
        gl = null;
        return;
      }

      needsResize = true;
      resizeCanvas();
      syncAnimation();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (
        event.pointerType === "touch"
        || coarsePointerQuery.matches
        || !hoverPointerQuery.matches
      ) {
        targetHover = 0;
        return;
      }

      const bounds = root.getBoundingClientRect();
      const isInside = (
        event.clientX >= bounds.left
        && event.clientX <= bounds.right
        && event.clientY >= bounds.top
        && event.clientY <= bounds.bottom
      );

      if (!isInside || bounds.width <= 0 || bounds.height <= 0) {
        targetHover = 0;
        targetPointerVelocity[0] = 0;
        targetPointerVelocity[1] = 0;
        lastPointerTime = 0;
        return;
      }

      const nextPointerX = Math.min(
        1,
        Math.max(0, (event.clientX - bounds.left) / bounds.width),
      );
      const nextPointerY = Math.min(
        1,
        Math.max(0, 1 - (event.clientY - bounds.top) / bounds.height),
      );

      const now = event.timeStamp;
      if (lastPointerTime > 0) {
        const elapsedSeconds = Math.max(0.001, (now - lastPointerTime) / 1000);
        let velocityX = (nextPointerX - targetPointer[0]) / elapsedSeconds;
        let velocityY = (nextPointerY - targetPointer[1]) / elapsedSeconds;
        const aspect = bounds.width / Math.max(bounds.height, 1);
        const physicalSpeed = Math.hypot(velocityX * aspect, velocityY);
        const maxPointerSpeed = 2.4;
        if (physicalSpeed > maxPointerSpeed) {
          const scale = maxPointerSpeed / physicalSpeed;
          velocityX *= scale;
          velocityY *= scale;
        }
        targetPointerVelocity[0] = velocityX;
        targetPointerVelocity[1] = velocityY;
        interactionEnergy = Math.max(
          interactionEnergy,
          Math.hypot(velocityX * aspect, velocityY),
        );
      } else {
        pointer[0] = nextPointerX;
        pointer[1] = nextPointerY;
      }

      targetPointer[0] = nextPointerX;
      targetPointer[1] = nextPointerY;
      lastPointerTime = now;
      targetHover = 1;
    };

    const resetPointer = () => {
      targetHover = 0;
      targetPointerVelocity[0] = 0;
      targetPointerVelocity[1] = 0;
      lastPointerTime = 0;
    };

    const handleVisibilityChange = () => syncAnimation();
    const handleMotionPreferenceChange = () => syncAnimation();
    const handlePointerCapabilityChange = () => resetPointer();
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      resources = null;
      canvas.style.opacity = "0";
      stopAnimation();
    };
    const handleContextRestored = () => {
      if (!gl || cancelled) return;
      contextLost = false;
      resources = createProgramResources(gl, image);
      needsResize = true;
      resizeCanvas();
      syncAnimation();
    };

    const resizeObserver = new ResizeObserver(() => {
      needsResize = true;
    });
    resizeObserver.observe(root);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isIntersecting = entry?.isIntersecting ?? true;
        syncAnimation();
      },
      { rootMargin: "120px 0px" },
    );
    intersectionObserver.observe(root);

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("blur", resetPointer);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    reducedMotionQuery.addEventListener("change", handleMotionPreferenceChange);
    coarsePointerQuery.addEventListener("change", handlePointerCapabilityChange);
    hoverPointerQuery.addEventListener("change", handlePointerCapabilityChange);
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);

    if (image.complete && image.naturalWidth > 0) {
      initializeWebGl();
    } else {
      image.addEventListener("load", initializeWebGl, { once: true });
    }

    return () => {
      cancelled = true;
      stopAnimation();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      image.removeEventListener("load", initializeWebGl);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("blur", resetPointer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      reducedMotionQuery.removeEventListener("change", handleMotionPreferenceChange);
      coarsePointerQuery.removeEventListener("change", handlePointerCapabilityChange);
      hoverPointerQuery.removeEventListener("change", handlePointerCapabilityChange);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      if (gl && !contextLost) destroyProgramResources(gl, resources);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={className}
      aria-hidden="true"
      style={{
        height: "100%",
        isolation: "isolate",
        overflow: "hidden",
        pointerEvents: "none",
        position: "absolute",
        width: "100%",
      }}
    >
      {/* This eager, same-origin texture is also the no-WebGL fallback. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        src={TEXTURE_URL}
        alt=""
        decoding="async"
        draggable={false}
        loading="eager"
        style={{
          height: "100%",
          inset: 0,
          objectFit: "cover",
          position: "absolute",
          width: "100%",
        }}
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        role="presentation"
        style={{
          height: "100%",
          inset: 0,
          opacity: 0,
          position: "absolute",
          transition: "opacity 600ms ease",
          width: "100%",
        }}
      />
    </div>
  );
}
