import { useFormContext } from "react-hook-form";
import { KycFormData } from "@/schemas/kyc.schema";

export default function StepThree() {
  const { getValues } = useFormContext<KycFormData>();
  const values = getValues(); // get all current form values

  return (
    <div className="w-full flex flex-col gap-4 text-[#0a0a0a] ">
      <h2 className="text-[#ff3e00] font-semibold text-lg md:text-xl">
        Review Your Details
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-medium text-neutral-500">Full Name</h3>
          <p className="text-[#0a0a0a] text-sm">{values.fullName}</p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-neutral-500">Email</h3>
          <p className="text-[#0a0a0a] text-sm">{values.email}</p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-neutral-500">Date of Birth</h3>
          <p className="text-[#0a0a0a] text-sm">{values.date_of_birth}</p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-neutral-500">Nationality</h3>
          <p className="text-[#0a0a0a] text-sm">{values.nationality}</p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-neutral-500">Phone Number</h3>
          <p className="text-[#0a0a0a] text-sm">{values.phone_number}</p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-neutral-500">
            Residential Address
          </h3>
          <p className="text-[#0a0a0a] text-sm">{values.residential_address}</p>
        </div>
      </div>
    </div>
  );
}