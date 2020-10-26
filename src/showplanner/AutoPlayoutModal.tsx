import React from "react";
import { FaTimes, FaPlayCircle } from "react-icons/fa";
import Modal from "react-modal";
import { Button } from "reactstrap";

interface AutoPlayoutProps {
  isOpen: boolean;
  close: () => any;
}

export function AutoPlayoutModal(props: AutoPlayoutProps) {
  return (
    <Modal isOpen={props.isOpen} onRequestClose={props.close}>
      <div>
        <h1 className="d-inline">
          <FaPlayCircle className="mx-2" size={30} />
          URY Automatic Playout
        </h1>
        <Button
          onClick={props.close}
          className="float-right pt-1"
          color="primary"
        >
          <FaTimes />
        </Button>
      </div>
      <hr />
      <iframe
        id="playoutIframe"
        src={process.env.REACT_APP_MYRADIO_NONAPI_BASE + "/NIPSWeb/playout/"}
        frameBorder="0"
        title="URY Automatic Playout"
      ></iframe>
      <div></div>
    </Modal>
  );
}
