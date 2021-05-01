import React from "react";
import { FaTimes } from "react-icons/fa";
import Modal from "react-modal";
import { Button } from "reactstrap";

import { LoadShowDialogue } from "./loadshow";
import "./BAPSicleModal.scss";
import { SidebarDialogue } from "./sidebar";

interface BAPSicleModalProps {
  isOpen: boolean;
  close: () => any;
}

export function BAPSicleModal(props: BAPSicleModalProps) {
  return (
    <Modal isOpen={props.isOpen} onRequestClose={props.close}>
      <h1 className="d-inline">Menu</h1>
      <Button
        onClick={props.close}
        className="float-right pt-1"
        color="primary"
      >
        <FaTimes />
      </Button>
      <hr className="mt-1 mb-3" />
      <div className="row">
        <div className="col-8">
          <LoadShowDialogue close={props.close} />
        </div>
        <div className="col-4">
          <SidebarDialogue />
        </div>
      </div>
    </Modal>
  );
}
