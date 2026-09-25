import bobLogoUrl from '../../../../../resources/app-icons/bob-live-collab.png?url'

export function LiveCollabMark(): React.JSX.Element {
  return (
    <img
      src={bobLogoUrl}
      alt="Three Bob agents working together"
      className="size-40 object-contain"
      draggable={false}
    />
  )
}
