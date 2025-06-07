import { ViewEncapsulation, AfterViewInit, ChangeDetectionStrategy, Component, EventEmitter, Input, Output, Renderer2, ViewChild } from '@angular/core';
import { IntersectionStatus } from './observables/from-intersection-observer';

export enum MarqueeState {
  Running = "running",
  Paused = "paused",
  Stopped = "stopped"
}

export enum MarqueeDirection {
  Left = 'left',
  Right = 'right',
  Alternate = 'alternate'
}

export enum MarqueeAnimation {
  Default = 'default',
  SlideInUp = 'slideInUp',
  SlideInDown = 'slideInDown'
}

@Component({
    selector: 'ngx-marquee',
    templateUrl: './ngx-marquee.component.html',
    styleUrls: ['./ngx-marquee.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false,

    // This is necessary because the default, ViewEncasulation.Emulated, in order to keep all css selector names
    // independent acros components, mangles the css selector names (including the animation keyframe names).
    // But we're using Renderer2 to manually reference those names (now unmangled) here in the typescript.
    // Setting encapsulation to None means that it won't mangle them.  That's fine because they're all prefixed
    // with 'ngx-marquee' anyway.
    encapsulation: ViewEncapsulation.None
})
export class NgxMarqueeComponent implements AfterViewInit {

  @Input() direction: MarqueeDirection;
  @Input() duration: string;
  @Input() pauseOnHover: boolean;
  @Input() animation: MarqueeAnimation;
  @Input() taskOnUpdateContent: () => void;
  @Input() taskOnUpdateDuration: () => string; // Formato esperado "number[s|ms]"
  @Input() pendingUpdates: boolean;
  @Output() pendingUpdatesChange: EventEmitter<boolean>;
  @Output() playStateChange: EventEmitter<MarqueeState>;
  @ViewChild("tape") tape: HTMLElement;

  readonly root: HTMLElement;
  readonly rootMargin: string;
  readonly threshold: number | number[];
  readonly debounce: number;
  
  private _elementMarquee: any;
  private _outerFlags = [false, false];
  private _dataPlayState: MarqueeState; 

  constructor( private _renderer: Renderer2 )
  {
    this.debounce = 0;
    this.root = undefined;
    this.rootMargin = '0px';
    this.threshold = 0;
    this.duration = '20s';
    this.animation = MarqueeAnimation.Default;
    this.pauseOnHover = false;
    this.pendingUpdates = false;
    this.pendingUpdatesChange = new EventEmitter<boolean>();
    this.playStateChange = new EventEmitter<MarqueeState>();

    if (typeof this.taskOnUpdateContent !== 'function')
    {
      this.taskOnUpdateContent = (): void => {};
    }

    if (typeof this.taskOnUpdateDuration !== 'function')
    {
      this.taskOnUpdateDuration = (): string => {
        return this.duration;
      };
    }
  }

  ngAfterViewInit(): void
  {
    this._elementMarquee = this._renderer.selectRootElement(this.tape, true).nativeElement;
    this._resetMarquee();
  }

  public playPause(): void
  {
    if ( this._dataPlayState === null || this._dataPlayState === MarqueeState.Running )
    {
      this._pauseElement();
    }
    else
    {
      this._playElement();
    }
  }

  public stop(): void
  {
    this._resetAnimation();
    this._stopElement();
  }

  public restart(): void
  {
    this._resetAnimation();
    this._playElement();
  }
 
  onVisibilityChanged(status: IntersectionStatus, control: number): void
  {
    if (status !== IntersectionStatus.Pending)
    {
      if (status === IntersectionStatus.Visible)
      {
        this._outerFlags[control] = true;
      }
      else if (status === IntersectionStatus.NotVisible)
      {
        this._outerFlags[control] = false;
      }
      
      if (this.pendingUpdates)
      {
        if ( (this.direction === undefined || this.direction === MarqueeDirection.Left) && (this._outerFlags[0] === true && this._outerFlags[1] === false) )
        { 
          this._execProcedure();
        }
        else if ( this.direction === MarqueeDirection.Right && (this._outerFlags[0] === false && this._outerFlags[1] === true) )
        {
          this._execProcedure();
        }
      }
    }  
  }

  private _execProcedure(): void
  {
    this.taskOnUpdateContent();
    this._resetMarquee();
    this._setPendingUpdates(false);
  }

  private _setDataPlayState( state: MarqueeState ): void
  {
    this._dataPlayState = state;
    this.playStateChange.emit(this._dataPlayState);
  }

  private _setPendingUpdates( state: boolean ): void
  {
    this.pendingUpdates = state;
    this.pendingUpdatesChange.emit(this.pendingUpdates);
  }

  private _resetMarquee(): void
  {
    this.stop();
    this._calculateDuration();
    this._playElement();
  }

  private _calculateDuration(): void
  {
    this.duration = this.taskOnUpdateDuration();          
  }

  private _playElement(): void
  {
    this._setAnimationState('running', true);
    this._setDataAttrState('running');
    this._setDataPlayState(MarqueeState.Running);
  }

  private _pauseElement(): void
  {
    this._setAnimationState('paused');
    this._setDataAttrState('paused');
    this._setDataPlayState(MarqueeState.Paused);
  }

  private _stopElement(): void
  {
    this._setAnimationState('paused');
    this._setDataAttrState('stopped');
    this._setDataPlayState(MarqueeState.Stopped);
    this._setPendingUpdates(false);
  }

  private _setAnimationState( state: string = '', fix: boolean = false ): void
  {
    this._renderer.setStyle(this._elementMarquee, 'animation-play-state', state);
    
    if (fix)
    {
      this._fixAnimationState();
    }
  }

  private _resetAnimation(): void
  {
    this._renderer.setStyle(this._elementMarquee, 'animation', 'none');
    let fix = this._elementMarquee.offsetWidth; fix = fix;

    this._renderer.setStyle(this._elementMarquee, 'animation', `${this.duration} linear infinite`);
    this._renderer.setStyle(this._elementMarquee, '-webkit-animation', `${this.duration} linear infinite`);

    switch (this.direction)
    {
      case 'alternate': this._renderer.setStyle(this._elementMarquee, 'animation-direction', 'alternate'); break;
      default: this._renderer.setStyle(this._elementMarquee, 'animation-direction', 'normal'); break;
    }

    if (this.direction !== MarqueeDirection.Alternate)
    {
      if (this.direction === undefined || this.direction === MarqueeDirection.Left)
      {
        if (this.animation === MarqueeAnimation.SlideInUp)
        {
          this._renderer.setStyle(this._elementMarquee, 'animation-name', 'ngx-marquee-slide-in-up');
        }
        else if (this.animation === MarqueeAnimation.SlideInDown)
        {
          this._renderer.setStyle(this._elementMarquee, 'animation-name', 'ngx-marquee-slide-in-down');
        }
        else
        {
          this._renderer.setStyle(this._elementMarquee, 'animation-name', 'ngx-marquee-movement-smooth');
        }
      }
      else if (this.direction === MarqueeDirection.Right)
      {
        if (this.animation === MarqueeAnimation.SlideInUp)
        {
          this._renderer.setStyle(this._elementMarquee, 'animation-name', 'ngx-marquee-slide-in-up-right');
        }
        else if (this.animation === MarqueeAnimation.SlideInDown)
        {
          this._renderer.setStyle(this._elementMarquee, 'animation-name', 'ngx-marquee-slide-in-down-right');
        }
        else
        {
          this._renderer.setStyle(this._elementMarquee, 'animation-direction', 'reverse');
          this._renderer.setStyle(this._elementMarquee, 'animation-name', 'ngx-marquee-movement-smooth');
        }
      }
    }
    else
    {
      this._renderer.setStyle(this._elementMarquee, 'animation-name', 'ngx-marquee-movement-smooth');
    }

  }

  private _setDataAttrState( state: string = '' ): void
  {
    this._renderer.setAttribute(this._elementMarquee, 'data-play-state', state);
  }

  private _fixAnimationState(): void
  {
    this._renderer.removeStyle(this._elementMarquee, 'animation-play-state');
  }

}
