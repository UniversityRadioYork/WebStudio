import React from "react";
import Modal from "react-modal";

interface WelcomeModalProps {
	isOpen: boolean;
	close: () => any;
}

export function WelcomeModal(props: WelcomeModalProps) {
	return (
		<Modal isOpen={props.isOpen} onRequestClose={props.close}>
			<h1>Welcome to WebStudio!</h1>
			<p>
				As you are not WebStudio Trained, you will be able to access all WebStudio features except going live.
				If you want to go live, ask in #remote-broadcasting on Slack about getting trained.
			</p>
			<p>
				If you encounter any bugs or issues in WebStudio, please report them to Computing in #remote-broadcasting.
			</p>
			<p>
				Thank you, and have fun!
			</p>
			<div>
				<button className="btn btn-primary" onClick={props.close}>Close</button>
			</div>
		</Modal>
	);
}