import { User } from "lucide-react";
import { Input } from "../ui";




export default function StepOne() {
    return (
        <div className="flex flex-col gap-6 items-start w-full " >
            <h2 className="text-[#ff3e00] font-semibold text-lg md:text-xl  " >Personal Information</h2>


            <div className=" w-full grid grid-cols-1 md:grid-cols-2 place-items-center justify-center justify-items-center gap-7 " >

                <div className="w-full flex flex-col items-start gap-1" >
                    <h3 className="text-sm md:text-base font-medium" >Full name</h3>
                    <Input
                        placeholder="Okeke Chinedu"
                        value={""}
                        // onChange={}
                        leftIcon={<User className="w-3 h-3 " />}
                    />
                </div>


                <div className="w-full flex flex-col items-start gap-1" >
                    <h3 className="text-sm md:text-base font-medium" >Email</h3>
                    <Input
                        placeholder="chiscookeke11@gmail.com"
                        value={""}
                        // onChange={}
                        leftIcon={<User className="w-3 h-3 " />}
                    />
                </div>


                <div className="w-full flex flex-col items-start gap-1" >
                    <h3 className="text-sm md:text-base font-medium" >Full name</h3>
                    <Input
                        placeholder="Okeke Chinedu"
                        value={""}
                        // onChange={}
                        leftIcon={<User className="w-3 h-3 " />}
                    />
                </div>


                <div className="w-full flex flex-col items-start gap-1" >
                    <h3 className="text-sm md:text-base font-medium" >Full name</h3>
                    <Input
                        placeholder="Okeke Chinedu"
                        value={""}
                        // onChange={}
                        leftIcon={<User className="w-3 h-3 " />}
                    />
                </div>



            </div>
        </div>
    )
}