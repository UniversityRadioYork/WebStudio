import React from "react";
import { FaTimes, FaFileImport } from "react-icons/fa";
import Modal from "react-modal";
import { Button } from "reactstrap";

interface ImporterProps {
  isOpen: boolean;
  close: () => any;
}

// TODO: This needs updating to actually either provide the weighting channel values (less preferred)
// or update the importer to work that out itself.
export function ImporterModal(props: ImporterProps) {
  return (
    <Modal isOpen={props.isOpen} onRequestClose={props.close}>
      <div>
        <h1 className="d-inline">
          <FaFileImport className="mx-2" size={30} />
          Import from Showplan
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
        id="uploadIframe"
        src="https://ury.org.uk/myradio/NIPSWeb/import/"
        frameBorder="0"
        title="Import From Showplan"
      ></iframe>
      <div></div>
    </Modal>
  );
}
