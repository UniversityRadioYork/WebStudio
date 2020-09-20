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
import { audioEngine, LevelsSource } from "../../mixer/audio";

interface VUMeterProps extends HTMLProps<HTMLCanvasElement> {
  range: [number, number];
  greenRange?: [number, number];
  source: LevelsSource;
  stereo: boolean;
}

export function VUMeter(props: VUMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const isMicOpen = useSelector((state: RootState) => state.mixer.mic.open);
  const rafRef = useRef<number | null>(null);
  const [peakL, setPeakL] = useState(-Infinity);
  const [peakR, setPeakR] = useState(-Infinity);

  const isMic = props.source.substr(0, 3) === "mic";

  useEffect(() => {
    const animate = () => {
      if (!isMic || isMicOpen) {
        const result = audioEngine.getLevels(props.source, props.stereo);
        setPeakL(result[0]);
        if (props.stereo) {
          setPeakR(result[1]);
        }
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    if (!isMic || isMicOpen) {
      rafRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isMicOpen, isMic, props.source, props.stereo]);

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

    if (props.greenRange) {
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

      if (
        (peakL >= props.greenRange[0] && peakL <= props.greenRange[1])
        || (props.stereo && peakR >= props.greenRange[0] && peakR <= props.greenRange[1])
      ) {
        ctx.fillStyle = "#00ff00";
      } else if (
        (peakL < props.greenRange[0])
        || (props.stereo && peakR < props.greenRange[0])
      ) {
        ctx.fillStyle = "#e8d120";
      } else {
        ctx.fillStyle = "#ff0000";
      }
    } else {
      ctx.fillStyle = "#e8d120";
    }


    const valueOffsetL =
      (Math.max(peakL, props.range[0]) - props.range[0]) / valueRange;

    let valueOffsetR = 0;
    if (props.stereo) {
      valueOffsetR =
        (Math.max(peakR, props.range[0]) - props.range[0]) / valueRange;
    } else {
      valueOffsetR = valueOffsetL;
    }


    ctx.fillRect(0, 0, valueOffsetL * width, height/2 - 7);
    ctx.fillRect(0, height/2 - 6, valueOffsetR * width, height / 2 - 7);

    ctx.fillStyle = "#fff";
    for (let i = 0; i < 10; i++) {
      const value = (props.range[0] + valueRange * (i / 10)).toFixed(0);
      ctx.fillText(value, width * (i / 10), height - 2);
    }
  }, [peakL, peakR, props.range, props.greenRange, props.stereo]);

  const { value, range, greenRange, source, ...rest } = props;

  return <canvas ref={canvasRef} {...rest} />;
}
