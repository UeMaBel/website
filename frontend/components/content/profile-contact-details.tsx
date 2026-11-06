import Image from "next/image";
import type { ProfileLink } from "../../lib/api";
import { ProfileContactLinks } from "./profile-contact-links";

export function ProfileContactDetails({ name, email, links }: { name: string; email: string; links: ProfileLink[] }) {
  return (
    <div className="contact-person">
      <Image className="contact-portrait" src="/images/portrait.jpg" alt="Portrait of Matthias Uebelacker" width={80} height={80} sizes="80px" />
      <div className="contact-person-copy">
        <p className="contact-person-name">{name.trim() || "Matthias Uebelacker"}</p>
        <ProfileContactLinks email={email} links={links} />
      </div>
    </div>
  );
}
