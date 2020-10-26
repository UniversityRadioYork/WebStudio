import React, { useEffect } from "react";
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
  // Add support for closing the modal when the importer wants to reload the show plan.
  // There is a similar listener in showplanner/index.tsx to actually reload the show plan.
  useEffect(() => {
    function reloadListener(event: MessageEvent) {
      if (!event.origin.includes("ury.org.uk")) {
        return;
      }
      if (event.data === "reload_showplan") {
        props.close();
      }
    }

    window.addEventListener("message", reloadListener);
    return () => {
      window.removeEventListener("message", reloadListener);
    };
  });
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
        id="importerIframe"
        src={process.env.REACT_APP_MYRADIO_NONAPI_BASE + "/NIPSWeb/import/"}
        frameBorder="0"
        title="Import From Showplan"
      ></iframe>
      <div></div>
    </Modal>
  );
}
