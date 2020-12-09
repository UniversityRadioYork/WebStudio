import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardLink,
  CardTitle,
  Form,
  Input,
  InputGroup,
  InputGroupAddon,
  Label,
} from "reactstrap";
import { RootState } from "../rootReducer";
import { MultiConnectionState } from "./state";
import Modal from "react-modal";
import { actions } from "./state";
import { FaPaperPlane } from "react-icons/fa";

function InviteLinkModalContents(props: { close: () => any }) {
  const [name, setName] = useState("");
  const [uses, setUses] = useState<number | undefined>();
  const dispatch = useDispatch();
  const links = useSelector((state: RootState) => state.multi.inviteLinks);
  const linkCreateState = useSelector(
    (state: RootState) => state.multi.inviteLinkCreateStatus
  );

  useEffect(() => {
    dispatch(actions.refreshInviteLinks());
  }, []);

  function create() {
    dispatch(
      actions.createInviteLink({
        name,
        uses,
      })
    );
  }

  return (
    <>
      <h3>Invite Links for this rom</h3>
      <div>
        {links.map((link) => (
          <Card key={link.code}>
            <CardTitle>
              {link.name}
            </CardTitle>
            <CardBody>
              <Input disabled value={link.url} />
            </CardBody>
            <CardFooter>
              Uses: {link.uses}
              {link.max_uses > -1 && " / " + link.max_uses}
            </CardFooter>
            <CardLink color="danger">Revoke</CardLink>
          </Card>
        ))}
      </div>
      <h3>Create Invite Link</h3>
      <Form>
        <InputGroup>
          Guest Name
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Guest Name"
          />
        </InputGroup>
        <InputGroup>
          <Label>
            Max Number of Uses (leave blank for unlimited)
            <Input
              type="number"
              value={uses}
              onChange={(e) =>
                setUses(
                  e.target.value.length > 0
                    ? parseInt(e.target.value)
                    : undefined
                )
              }
              min={0}
            />
          </Label>
        </InputGroup>
        <Button
          color="primary"
          onClick={create}
          disabled={linkCreateState === "pending"}
        >
          Create
        </Button>
        <Button color="danger" onClick={props.close}>
          Close
        </Button>
        {linkCreateState === "error" && (
          <Alert color="danger">Oh no, something exploded!</Alert>
        )}
      </Form>
    </>
  );
}

export function GuestsSidebarTab() {
  const multiState = useSelector((state: RootState) => state.multi);
  const dispatch = useDispatch();

  const [isCreateLinkModalOpen, setIsCreateLinkModalOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState("");

  const sendMsg = () => {
    dispatch(actions.sendChatMessage(chatMsg));
    setChatMsg("");
  };

  if (multiState.state === MultiConnectionState.NONE) {
    return (
      <div className="h-100 d-flex justify-content-center align-items-center">
        <div>
          <Button color="primary" onClick={() => dispatch(actions.connect())}>
            Connect to guests
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="h-100 d-flex justify-content-center align-items-center flex-column">
      <div className="mb-auto">
        <div>{multiState.state}</div>
        <div>
          <div>
            <em>In this room:</em>
          </div>
          {multiState.room &&
            multiState.room.peers.map((peer) => (
              <div key={peer.id}>
                <b>{peer.name}</b> <em>({peer.security_level})</em>
                {multiState.us?.id === peer.id && " (you!)"}
              </div>
            ))}
        </div>
      </div>
      <div className="mt-auto">
        <div>
          {multiState.chatMessages.map((x, idx) => (
            <p key={idx}>
              <b>{x.from}</b>: {x.em ? <em>{x.msg}</em> : x.msg}
            </p>
          ))}
        </div>
        <InputGroup>
          <Input value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} />
          <InputGroupAddon addonType="append">
            <Button color="success" onClick={sendMsg}>
              <FaPaperPlane />
            </Button>
          </InputGroupAddon>
        </InputGroup>
        <div>
          <Button
            color="primary"
            onClick={() => setIsCreateLinkModalOpen(true)}
          >
            Create Invite Link
          </Button>
          <Button color="danger" onClick={() => dispatch(actions.disconnect())}>
            Disconnect
          </Button>
        </div>
      </div>
      <Modal
        isOpen={isCreateLinkModalOpen}
        onRequestClose={() => setIsCreateLinkModalOpen(false)}
      >
        <InviteLinkModalContents
          close={() => setIsCreateLinkModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
