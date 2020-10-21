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
      <h1 className="d-inline">
        <FaMicrophone className="mx-2" size={30} />
        Recording Complete
      </h1>
      <Button
        onClick={props.close}
        className="float-right pt-1"
        color="primary"
      >
        <FaTimes />
      </Button>
      <hr className="mt-1 mb-3" />
      <p>
        Your recording is now complete. You can listen to it back and then
        download it, add it to your show plan, or delete it by closing this
        window.
        {BroadcastState.getRecording()}
      </p>
    </Modal>
  );
}
