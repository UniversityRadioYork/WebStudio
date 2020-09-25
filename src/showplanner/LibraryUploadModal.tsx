import React from "react";
import { FaTimes, FaUpload } from "react-icons/fa";
import Modal from "react-modal";
import { Button } from "reactstrap";

interface LibraryUploadProps {
  isOpen: boolean;
  close: () => any;
}

export function LibraryUploadModal(props: LibraryUploadProps) {
  return (
    <Modal isOpen={props.isOpen} onRequestClose={props.close}>
      <div>
        <h1 className="d-inline">
          <FaUpload className="mx-2" size={30} />
          Upload to Library
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
        src="https://ury.org.uk/myradio/NIPSWeb/manage_library/"
        frameBorder="0"
        title="Upload to Library"
      ></iframe>
      <div></div>
    </Modal>
  );
}
