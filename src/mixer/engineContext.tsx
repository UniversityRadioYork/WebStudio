import React, {useContext, useLayoutEffect, useMemo} from "react";
import {AudioEngine} from "./state/audio";
import {useStore} from "react-redux";

// @ts-ignore - it gets created before it ever gets used
export const EngineContext = React.createContext<AudioEngine>();

export function useAudioEngine(): AudioEngine {
    return useContext(EngineContext);
}

export function AudioEngineProvider(props: any) {
    const store = useStore();
    const engine = useMemo(() => new AudioEngine(store), [store]);
    useLayoutEffect(() => {
        (window as any).AE = engine;
        return () => {
            delete (window as any).AE;
        }
    }, [engine]);

    return (
        <EngineContext.Provider value={engine}>{props.children}</EngineContext.Provider>
    );
}
