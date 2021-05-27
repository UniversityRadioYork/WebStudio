import React from "react";
import { FaTimes } from "react-icons/fa";
import Modal from "react-modal";
import { Button } from "reactstrap";

interface WelcomeModalProps {
  isOpen: boolean;
  close: () => any;
}

export function WelcomeModal(props: WelcomeModalProps) {
  return (
    <Modal isOpen={props.isOpen} onRequestClose={props.close}>
      <h1 className="d-inline">Welcome to WebStudio!</h1>
      <Button
        onClick={props.close}
        className="float-right pt-1"
        color="primary"
      >
        <FaTimes />
      </Button>
      <hr className="mt-1 mb-3" />
      <p>
        As you are not WebStudio Trained, you will be able to access all
        WebStudio features except going live. If you want to go live, ask in
        #remote-broadcasting on Slack about getting trained.
      </p>
      <p>
        If you encounter any bugs or issues in WebStudio, please report them to
        Computing in #remote-broadcasting.
      </p>
      <p>Thank you, and have fun!</p>
    </Modal>
  );
}
