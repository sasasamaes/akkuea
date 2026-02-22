import { render, screen } from "@testing-library/react";
import KYCStatus from "../KYCStatus";
import '@testing-library/jest-dom';



describe("KYCStatus", () => {
  it("displays pending status", () => {
    render(<KYCStatus status="pending" />);
    expect(screen.getByText(/Verification Pending/i)).toBeInTheDocument();
  });

  it("displays approved status", () => {
    render(<KYCStatus status="approved" />);
    expect(screen.getByText(/KYC Approved/i)).toBeInTheDocument();
  });

  it("displays rejected status", () => {
    render(<KYCStatus status="rejected" />);
    expect(screen.getByText(/KYC Rejected/i)).toBeInTheDocument();
  });
});