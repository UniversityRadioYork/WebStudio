import React, { useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../rootReducer";

import * as BroadcastState from "../broadcast/state";
import appLogo from "../assets/images/webstudio.svg";
import { MYRADIO_NON_API_BASE } from "../api";
import "./navbar.scss";
import { closeAlert } from "./state";

export function NavBar() {
	const dispatch = useDispatch();
	const sessionState = useSelector((state: RootState) => state.session);
	const broadcastState = useSelector((state: RootState) => state.broadcast);
	const redirect_url = encodeURIComponent(window.location.toString());
	return (
		<>
			<div className="navbar-nav">
				<a className="navbar-brand" href="/">
					<img
						src="//ury.org.uk/myradio/img/URY.svg"
						height="30"
						alt="University Radio York Logo"
					/>
				</a>
				<span className="navbar-brand divider"></span>
				<a className="navbar-brand" href="/">
					<img src={appLogo} height="28" alt="Web Studio Logo" />
				</a>
			</div>

			<ul className="nav navbar-nav navbar-right">
				<li className="nav-item nav-link">
					<button
						className=""
						onClick={() =>
							dispatch(BroadcastState.toggleTracklisting())
						}
					>
						{broadcastState.tracklisting
							? "Tracklisting!"
							: "Not Tracklisting"}{" "}
					</button>
				</li>
				<li className="nav-item nav-link">
					<button
						className=""
						onClick={() =>
							dispatch(
								broadcastState.connectionState ===
									"NOT_CONNECTED"
									? BroadcastState.connect()
									: BroadcastState.disconnect()
							)
						}
					>
						{broadcastState.connectionState}
					</button>
				</li>
				<li className="nav-item dropdown">
					<a
						className="nav-link dropdown-toggle"
						href={
							MYRADIO_NON_API_BASE +
							"/MyRadio/timeslot/?next=" +
							redirect_url
						}
						id="timeslotDropdown"
						data-toggle="dropdown"
						aria-haspopup="true"
						aria-expanded="false"
					>
						<span className="fa fa-clock-o"></span>&nbsp;
						{sessionState.currentTimeslot &&
							sessionState.currentTimeslot.start_time}
					</a>
					<div
						className="dropdown-menu"
						aria-labelledby="timeslotDropdown"
					>
						<a
							className="dropdown-item"
							href={
								MYRADIO_NON_API_BASE +
								"/MyRadio/timeslot/?next=" +
								redirect_url
							}
						>
							Switch Timeslot
						</a>
						<h6 className="dropdown-header">
							{sessionState.currentTimeslot?.title}
						</h6>
						<h6 className="dropdown-header">
							ID: {sessionState.currentTimeslot?.timeslot_id}
						</h6>
					</div>
				</li>
				<li className="nav-item dropdown">
					<a
						className="nav-link dropdown-toggle"
						href={MYRADIO_NON_API_BASE + "/Profile/default/"}
						id="dropdown07"
						data-toggle="dropdown"
						aria-haspopup="true"
						aria-expanded="false"
					>
						<i className="fa fa-user-o"></i>&nbsp;
						{sessionState.currentUser?.fname}{" "}
						{sessionState.currentUser?.sname}
					</a>
					<div className="dropdown-menu" aria-labelledby="dropdown07">
						<a
							className="dropdown-item"
							target="_blank"
							href={MYRADIO_NON_API_BASE + "/Profile/default/"}
						>
							My Profile
						</a>
						<a
							className="dropdown-item"
							href={MYRADIO_NON_API_BASE + "/MyRadio/logout/"}
						>
							Logout
						</a>
					</div>
				</li>
			</ul>
		</>
	);
}

function AlertBar() {
	const state = useSelector((state: RootState) => state.navbar.currentAlert);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);
	const dispatch = useDispatch();
	useEffect(() => {
		if (timeoutRef.current !== null) {
			clearTimeout(timeoutRef.current);
		}
		if (typeof state?.closure === "number") {
			timeoutRef.current = setTimeout(() => {
				dispatch(closeAlert());
			}, state.closure);
		}
	}, [state?.closure, dispatch]);
	return (
		<div
			className={`alertbar alert alert-${state?.color} ${
				state !== null ? "visible" : ""
			}`}
		>
			{state?.content}
			{state?.closure !== null && (
				<button
					className="close"
					aria-label="Dismiss"
					onClick={() => dispatch(closeAlert())}
				>
					<span aria-hidden>&times;</span>
				</button>
			)}
		</div>
	);
}

export function CombinedNavAlertBar() {
	// TODO
	return (
		<>
			<AlertBar />
			<header className="navbar navbar-ury navbar-expand-md p-0 bd-navbar">
				<nav className="container">
					<button
						className="navbar-toggler"
						type="button"
						data-toggle="collapse"
						data-target="#collapsed"
						aria-controls="collapsed"
						aria-expanded="false"
						aria-label="Toggle navigation"
					>
						<span className="navbar-toggler-icon"></span>
					</button>
					<NavBar />
				</nav>
			</header>
		</>
	);
}
