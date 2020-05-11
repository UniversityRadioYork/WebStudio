import React, {useCallback, useRef, useState} from "react";
import {useInterval} from "../lib/useInterval";
import {
    FaSignal
} from "react-icons/fa";
import {Button, Popover, PopoverHeader} from "reactstrap";
import {streamer} from "./state";

interface StreamHealth {
    color: "GREEN" | "YELLOW" | "RED";
    degradationReason?: string;
    packetsLost: number;
    kbps: number;
    kbPerPacket: number;
}

const UPDATE_INTERVAL_SECS = 2;

export function StreamHealthIndicator() {
    const lastReportsRef = useRef<[any, any] | null>(null);
    const [health, setHealth] = useState<StreamHealth | null>(null);
    const [popoverOpen, setPopoverOpen] = useState(false);

    const update = useCallback(async () => {
        if (streamer === null) {
            setHealth(null);
            return;
        }
        const statsRaw = await streamer.getStatistics();
        console.log("raw stats", statsRaw);
        if (statsRaw === null) {
            setHealth(null);
            return;
        }
        const stats = Array.from(statsRaw);

        const outboundRtp = stats.find(x => x[1].type === "outbound-rtp");
        if (!outboundRtp) {
            setHealth(null);
            return;
        }
        const remoteInbound = stats.find(x => x[1].type === "remote-inbound-rtp" && x[1].localId === outboundRtp[1].id);
        if (!remoteInbound) {
            setHealth(null);
            return;
        }

        let lastBytesSent = 0;
        let lastPacketsSent = 0;
        let lastPacketLoss = 0;

        if (lastReportsRef.current !== null) {
            const [lastOutbound, lastRemoteInbound] = lastReportsRef.current;
            lastBytesSent = lastOutbound.bytesSent;
            lastPacketsSent = lastOutbound.packetsSent;
            lastPacketLoss = lastRemoteInbound.packetsLost;
        }

        const bytesPerSecond = ((outboundRtp[1].bytesSent) - lastBytesSent) / UPDATE_INTERVAL_SECS;
        const packetsPerSecond = ((outboundRtp[1].packetsSent) - lastPacketsSent) / UPDATE_INTERVAL_SECS;
        const packetLoss = (remoteInbound[1].packetsLost - lastPacketLoss) / UPDATE_INTERVAL_SECS;

        const report: StreamHealth = {
            color: "GREEN",
            kbps: bytesPerSecond / 128,
            kbPerPacket: (bytesPerSecond / 128) / packetsPerSecond,
            packetsLost: packetLoss
        };

        if (packetLoss > (packetsPerSecond / 2)) {
            report.color = "RED";
            report.degradationReason = "High packet loss";
        }
        if (packetLoss > 50) {
            report.color = "YELLOW";
            report.degradationReason = "Packet loss";
        }

        console.log("report", report);

        setHealth(report);
        lastReportsRef.current = [outboundRtp[1], remoteInbound[1]];
    }, [streamer]);

    useInterval(update, UPDATE_INTERVAL_SECS * 1000);

    if (health === null) {
        return null;
    }

    return (
        <>
            <Button id="signalBtn" outline color={health.color === "GREEN" ? "success" : health.color === "YELLOW" ? "warning" : "danger"}>
                <FaSignal />
            </Button>
            <Popover isOpen={popoverOpen} target="signalBtn" placement="bottom" toggle={() => setPopoverOpen(!popoverOpen)}>
                <PopoverHeader>
                    {health.degradationReason || "Stream healthy!"}
                </PopoverHeader>
                <table>
                    <tbody>
                        <tr>
                            <td>Packets lost</td>
                            <td>{health.packetsLost}</td>
                        </tr>
                        <tr>
                            <td>Data per packet</td>
                            <td>{health.kbPerPacket} kB</td>
                        </tr>
                        <tr>
                            <td>Data bitrate</td>
                            <td>{health.kbps} kBPS</td>
                        </tr>
                    </tbody>
                </table>
            </Popover>
        </>
    )
}
