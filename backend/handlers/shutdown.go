package handlers

// StopCh is closed by main when the server shuts down gracefully.
// Background goroutines should select on this channel to exit cleanly.
var StopCh = make(chan struct{})
