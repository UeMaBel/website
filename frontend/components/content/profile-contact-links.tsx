import type { ProfileLink } from "../../lib/api";
import { OutboundAnchor } from "../analytics/outbound-anchor";

export function ProfileContactLinks({ email, links }: { email: string; links: ProfileLink[] }) {
  return (
    <div className="profile-contact-links">
      {email.trim() ? (
        <p>
          Email: <OutboundAnchor
            href={`mailto:${email}`}
            category="contact_email"
          >
            {email}
          </OutboundAnchor>
        </p>
      ) : (
        <p role="status">Email contact is not available yet.</p>
      )}

      {links.length > 0 ? (
        <ul aria-label="Professional links">
          {links.map((link) => (
            <li key={`${link.position}-${link.url}`}>
              <OutboundAnchor
                href={link.url}
                target="_blank"
                rel="noreferrer"
                category="contact_profile"
              >
                {link.label}
              </OutboundAnchor>
            </li>
          ))}
        </ul>
      ) : (
        <p role="status">Professional links are not available yet.</p>
      )}
    </div>
  );
}
