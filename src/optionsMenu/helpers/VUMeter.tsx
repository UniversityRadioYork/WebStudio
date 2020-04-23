import React, {
  useRef,
  useLayoutEffect,
  useEffect,
  useCallback,
  useState,
  HTMLProps,
} from "react";
import { useSelector } from "react-redux";
import { RootState } from "../../rootReducer";
import { audioEngine } from "../../mixer/audio";

interface VUMeterProps extends HTMLProps<HTMLCanvasElement> {
  range: [number, number];
  greenRange: [number, number];
}

export function VUMeter(props: VUMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const state = useSelector((state: RootState) => state.mixer.mic);
  const rafRef = useRef<number | null>(null);
  const [peak, setPeak] = useState(-Infinity);
  const animate = useCallback(() => {
    if (state.open) {
      const result = audioEngine.getMicLevel();
      setPeak(result);
      rafRef.current = requestAnimationFrame(animate);
    }
  }, [state.open]);

  useEffect(() => {
    if (state.open) {
      rafRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [animate, state.open]);

  useLayoutEffect(() => {
    if (canvasRef.current) {
      ctxRef.current = canvasRef.current.getContext("2d");
    }
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !ctxRef.current) {
      return;
    }
    const valueRange = props.range[1] - props.range[0];
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;

    const ctx = ctxRef.current;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#4ab81c";
    const leftGreen =
      Math.abs(props.greenRange[0] - props.range[0]) / valueRange;
    const rightGreen =
      Math.abs(props.greenRange[1] - props.range[0]) / valueRange;
    ctx.fillRect(
      leftGreen * width,
      0,
      rightGreen * width - leftGreen * width,
      height
    );

    if (peak >= props.greenRange[0] && peak <= props.greenRange[1]) {
      ctx.fillStyle = "#00ff00";
    } else if (peak < props.greenRange[0]) {
      ctx.fillStyle = "#e8d120";
    } else {
      ctx.fillStyle = "#ff0000";
    }

    const valueOffset = Math.abs(peak - props.range[0]) / valueRange;

    ctx.fillRect(0, 0, valueOffset * width, height - 10);

    ctx.fillStyle = "#fff";
    for (let i = 0; i < 10; i++) {
      const value = (props.range[0] + valueRange * (i / 10)).toFixed(0);
      ctx.fillText(value, width * (i / 10), height - 7);
    }
  }, [peak, props.range, props.greenRange]);

  const { value, range, greenRange, ...rest } = props;

  return <canvas ref={canvasRef} {...rest} />;
}
