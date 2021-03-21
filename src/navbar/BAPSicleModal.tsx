import React from "react";
import { FaTimes } from "react-icons/fa";
import Modal from "react-modal";
import { Button } from "reactstrap";
import BAPSicleLogo from "../assets/images/bapsicle.png";

import { LoadShowDialogue } from "./loadshow";

interface BAPSicleModalProps {
  isOpen: boolean;
  close: () => any;
}

export function BAPSicleModal(props: BAPSicleModalProps) {
  return (
    <Modal isOpen={props.isOpen} onRequestClose={props.close}>
      <h1 className="d-inline">Load a Show</h1>
      <Button
        onClick={props.close}
        className="float-right pt-1"
        color="primary"
      >
        <FaTimes />
      </Button>
      <hr className="mt-1 mb-3" />
      <LoadShowDialogue close={props.close} />
    </Modal>
  );
}
