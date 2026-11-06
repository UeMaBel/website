import Image from "next/image";
import { Markdown } from "./markdown";

export function ProfileContactDetails({ introduction }: { introduction: string }) {
  return (
    <div className="contact-person">
      <Image className="contact-portrait" src="/images/portrait.jpg" alt="Portrait of Matthias Uebelacker" width={80} height={80} sizes="80px" />
      <div className="contact-person-copy">
        <Markdown source={introduction} />
      </div>
    </div>
  );
}
