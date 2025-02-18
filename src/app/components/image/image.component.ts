import { AfterViewInit, Component } from '@angular/core';
import { ImageService } from '../../services/image.service';

@Component({
  selector: 'app-image',
  imports: [],
  templateUrl: './image.component.html',
  styleUrl: './image.component.scss'
})
export class ImageComponent implements AfterViewInit {

  constructor(private imageService: ImageService) { }

  ngAfterViewInit() {
    this.imageService.initImageLayer();
  }

}
