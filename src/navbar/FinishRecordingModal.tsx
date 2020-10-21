import React from "react";
import { FaTimes, FaMicrophone } from "react-icons/fa";
import Modal from "react-modal";
import { Button } from "reactstrap";
import * as BroadcastState from "../broadcast/state";

interface FinishRecordingModal {
  isOpen: boolean;
  close: () => any;
}

export function FinishRecordingModal(props: FinishRecordingModal) {
  return (
    <Modal isOpen={props.isOpen} onRequestClose={props.close}>
      <div>
        <h1 className="d-inline">
          <FaMicrophone className="mx-2" size={30} />
          Recording Complete
        </h1>
        <Button
          onClick={props.close}
          className="float-right pt-2 pb-2"
          color="primary"
        >
          <FaTimes />
        </Button>
      </div>
      <hr />
      <p>
        Your recording is now complete. You can listen to it back and then
        download it and upload it to your show plan if you want.
      </p>

      <audio controls draggable={true}>
        <source src={BroadcastState.getRecording()} type="audio/mp3" />
      </audio>
      <div>
        <Button
          onClick={() => {
            const a = document.createElement("a");
            a.href = BroadcastState.getRecording()!;
            a.download = "recorded.mp3";
            a.click();
          }}
          className="pt-1"
          color="primary"
        >
          Download
        </Button>
      </div>

      <iframe
        id="uploadIframe"
        title="Recording Uploader"
        src={
          process.env.REACT_APP_MYRADIO_NONAPI_BASE + "/NIPSWeb/manage_library/"
        }
        frameBorder="0"
      ></iframe>
      <div></div>
    </Modal>
  );
}
